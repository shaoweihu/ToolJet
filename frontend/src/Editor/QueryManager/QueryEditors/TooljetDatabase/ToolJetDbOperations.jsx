import React, { useState, useEffect, useMemo, useRef } from 'react';
import cx from 'classnames';
import { tooljetDatabaseService, authenticationService } from '@/_services';
import { TooljetDatabaseContext } from '@/TooljetDatabase/index';
import { ListRows } from './ListRows';
import { CreateRow } from './CreateRow';
import { UpdateRows } from './UpdateRows';
import { DeleteRows } from './DeleteRows';
import { toast } from 'react-hot-toast';
import { queryManagerSelectComponentStyle } from '@/_ui/Select/styles';
import { useMounted } from '@/_hooks/use-mount';
import { JoinTable } from './JoinTable';
import { difference } from 'lodash';
import DropDownSelect from './DropDownSelect';
import { getPrivateRoute } from '@/_helpers/routes';
import { useNavigate } from 'react-router-dom';
import { deepClone } from '@/_helpers/utilities/utils.helpers';

import './styles.scss';
import CodeHinter from '@/Editor/CodeEditor';
import { useCurrentState } from '@/_stores/currentStateStore';

const ToolJetDbOperations = ({ optionchanged, options, darkMode, isHorizontalLayout, optionsChanged }) => {
  const computeSelectStyles = (darkMode, width) => {
    return queryManagerSelectComponentStyle(darkMode, width);
  };
  const currentState = useCurrentState();
  const navigate = useNavigate();
  const { current_organization_id: organizationId } = authenticationService.currentSessionValue;
  const mounted = useMounted();
  const [operation, setOperation] = useState(options['operation'] || '');
  const [columns, setColumns] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableInfo, setTableInfo] = useState({});
  const [activeTab, setActiveTab] = useState(options?.activeTab || 'GUI mode');
  const [selectedTableId, setSelectedTableId] = useState(options['table_id']);
  const [listRowsOptions, setListRowsOptions] = useState(() => options['list_rows'] || {});
  const [updateRowsOptions, setUpdateRowsOptions] = useState(
    options['update_rows'] || { columns: {}, where_filters: {} }
  );
  const [deleteRowsOptions, setDeleteRowsOptions] = useState(
    options['delete_rows'] || {
      limit: 1,
    }
  );
  const [joinTableOptions, setJoinTableOptions] = useState(options['join_table'] || {});
  const [tableForeignKeyInfo, setTableForeignKeyInfo] = useState({});

  const joinOptions = options['join_table']?.['joins'] || [
    { conditions: { conditionsList: [{ leftField: { table: selectedTableId } }] } },
  ];

  const setJoinOptions = (values) => {
    const tableSet = new Set();
    (values || []).forEach((join) => {
      const { table, conditions } = join;
      tableSet.add(table);
      conditions?.conditionsList?.forEach((condition) => {
        const { leftField, rightField } = condition;
        if (leftField?.table) {
          tableSet.add(leftField?.table);
        }
        if (rightField?.table) {
          tableSet.add(rightField?.table);
        }
      });
    });
    tableSet.add(selectedTableId);

    setJoinTableOptions((prevJoinOptions) => {
      const { conditions, order_by = [], joins: currJoins, fields: currFields = [] } = prevJoinOptions;
      const conditionsList = deepClone(conditions?.conditionsList || []);
      const newConditionsList = conditionsList.filter((condition) => {
        const { leftField } = condition || {};
        if (tableSet.has(leftField?.table)) {
          return true;
        }
        return false;
      });
      const newOrderBy = order_by.filter((order) => tableSet.has(order.table));

      //getting old states
      const currTableSet = new Set();
      (currJoins || []).forEach((join) => {
        const { table, conditions } = join;
        currTableSet.add(table);
        conditions?.conditionsList?.forEach((condition) => {
          const { leftField, rightField } = condition;
          if (leftField?.table) {
            currTableSet.add(leftField?.table);
          }
          if (rightField?.table) {
            currTableSet.add(rightField?.table);
          }
        });
      });
      currTableSet.add(selectedTableId);
      const newTables = difference([...tableSet], [...currTableSet]);
      const newFields = newTables.reduce(
        (acc, newTable) => [
          ...acc,
          ...(tableInfo[newTable]
            ? tableInfo[newTable].map((col) => ({
                name: col.Header,
                table: newTable,
              }))
            : []),
        ],
        []
      );

      const updatedFields = [...currFields.filter((field) => tableSet.has(field.table)), ...newFields];
      newTables.forEach((tableId) => tableId && loadTableInformation(tableId, true));

      return {
        ...prevJoinOptions,
        joins: values,
        conditions: {
          ...(conditions?.operator && { operator: conditions.operator }),
          conditionsList: newConditionsList,
        },
        order_by: newOrderBy,
        fields: updatedFields,
      };
    });
  };

  const joinOrderByOptions = options?.['join_table']?.['order_by'] || [];
  const setJoinOrderByOptions = (values) => {
    if (values.length) {
      setJoinTableOptions((prevJoinOptions) => {
        return {
          ...prevJoinOptions,
          order_by: values,
        };
      });
    } else {
      deleteJoinTableOptions('order_by');
    }
  };

  useEffect(() => {
    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tableSet = new Set();
    const joinOptions = options['join_table']?.['joins'];
    (joinOptions || []).forEach((join) => {
      const { table, conditions } = join;
      tableSet.add(table);
      conditions?.conditionsList?.forEach((condition) => {
        const { leftField, rightField } = condition;
        if (leftField?.table) {
          tableSet.add(leftField?.table);
        }
        if (rightField?.table) {
          tableSet.add(rightField?.table);
        }
      });
    });

    const tables = [...tableSet];
    tables.forEach((tableId) => tableId && loadTableInformation(tableId));
  }, [options['join_table']?.['joins'], tables]);

  useEffect(() => {
    selectedTableId && fetchTableInformation(selectedTableId, false, tables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableId]);

  useEffect(() => {
    if (mounted) {
      optionchanged('operation', operation);
      setListRowsOptions({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  useEffect(() => {
    if (mounted) {
      optionchanged('list_rows', listRowsOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRowsOptions]);

  useEffect(() => {
    mounted && optionchanged('delete_rows', deleteRowsOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteRowsOptions]);

  useEffect(() => {
    mounted && optionchanged('update_rows', updateRowsOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateRowsOptions]);

  useEffect(() => {
    mounted && optionchanged('join_table', joinTableOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinTableOptions]);

  const handleOptionsChange = (optionsChanged, value) => {
    setListRowsOptions((prev) => ({ ...prev, [optionsChanged]: value }));
  };

  const handleDeleteRowsOptionsChange = (optionsChanged, value) => {
    setDeleteRowsOptions((prev) => ({ ...prev, [optionsChanged]: value }));
  };

  const handleUpdateRowsOptionsChange = (optionsChanged, value) => {
    setUpdateRowsOptions((prev) => ({ ...prev, [optionsChanged]: value }));
  };

  const limitOptionChanged = (value) => {
    setListRowsOptions((prev) => ({ ...prev, limit: value }));
  };

  const offsetOptionChanged = (value) => {
    setListRowsOptions((prev) => ({ ...prev, offset: value }));
  };

  const deleteOperationLimitOptionChanged = (limit) => {
    setDeleteRowsOptions((prev) => ({ ...prev, limit: limit }));
  };

  const loadTableInformation = async (tableId, isNewTableAdded) => {
    const tableDetails = findTableDetails(tableId);
    if (tableDetails?.table_name && !tableInfo[tableDetails?.table_name]) {
      const { table_name } = tableDetails;
      const { data } = await tooljetDatabaseService.viewTable(organizationId, table_name);

      setTableInfo((info) => ({
        ...info,
        [table_name]: data?.result?.columns.map(({ column_name, data_type, keytype, ...rest }) => ({
          Header: column_name,
          accessor: column_name,
          dataType: data_type,
          isPrimaryKey: keytype?.toLowerCase() === 'primary key',
          ...rest,
        })),
      }));

      setTableForeignKeyInfo((fk_info) => ({
        ...fk_info,
        [table_name]: data?.result?.foreign_keys || [],
      }));

      if (isNewTableAdded) {
        setJoinTableOptions((joinOptions) => {
          const { fields } = joinOptions;
          const newFields = deepClone(fields).filter((field) => field.table !== tableId);
          newFields.push(
            ...(data?.result?.columns
              ? data.result.columns.map((col) => ({
                  name: col.column_name,
                  table: tableId,
                  // alias: `${tableId}_${col.column_name}`,
                }))
              : [])
          );

          return {
            ...joinOptions,
            fields: newFields,
          };
        });
      }
    }
  };

  const joinTableOptionsChange = (optionsChanged, value) => {
    setJoinTableOptions((prev) => ({ ...prev, [optionsChanged]: value }));
  };

  const deleteJoinTableOptions = (optionToDelete) => {
    setJoinTableOptions((prev) => {
      const prevOptions = { ...prev };
      if (prevOptions[optionToDelete]) delete prevOptions[optionToDelete];
      return prevOptions;
    });
  };

  const findTableDetailsWithTableList = (tableId, tableList) => {
    return tableList.find((table) => table.table_id == tableId);
  };

  const findTableDetails = (tableId) => {
    return tables.find((table) => table.table_id == tableId);
  };

  const findTableDetailsByName = (tableName) => {
    return tables.find((table) => table.table_name == tableName);
  };

  const value = useMemo(
    () => ({
      organizationId,
      tables,
      setTables,
      columns,
      setColumns,
      selectedTableId,
      setSelectedTableId,
      listRowsOptions,
      setListRowsOptions,
      limitOptionChanged,
      offsetOptionChanged,
      handleOptionsChange,
      deleteRowsOptions,
      handleDeleteRowsOptionsChange,
      deleteOperationLimitOptionChanged,
      updateRowsOptions,
      handleUpdateRowsOptionsChange,
      joinTableOptions,
      joinTableOptionsChange,
      tableInfo,
      loadTableInformation,
      joinOptions,
      setJoinOptions,
      joinOrderByOptions,
      setJoinOrderByOptions,
      deleteJoinTableOptions,
      findTableDetails,
      findTableDetailsByName,
      tableForeignKeyInfo,
      setTableForeignKeyInfo,
    }),
    [
      organizationId,
      tables,
      columns,
      listRowsOptions,
      deleteRowsOptions,
      updateRowsOptions,
      joinTableOptions,
      tableInfo,
      loadTableInformation,
      joinOptions,
      joinOrderByOptions,
      selectedTableId,
    ]
  );

  const triggerTooljetDBStatus = (key) => {
    if (key === 'addTJDBTable') {
      navigate(getPrivateRoute('database'));
    }
  };

  const fetchTables = async () => {
    const { error, data } = await tooljetDatabaseService.findAll(organizationId);

    triggerTooljetDBStatus();
    if (error) {
      toast.error(error?.message ?? 'Failed to fetch tables');
      return;
    }

    if (Array.isArray(data?.result)) {
      const tableList =
        data.result.map((table) => {
          return { table_name: table.table_name, table_id: table.id };
        }) || [];

      setTables(tableList);
      const selectedTableInfo = data.result.find((table) => table.id === options['table_id']);
      if (selectedTableInfo) {
        setSelectedTableId(selectedTableInfo.id);
        fetchTableInformation(selectedTableInfo.id, false, tableList);
      }
    }
  };

  /**
   * TODO: This function to be removed and replaced with loadTableInformation function everywhere
   */
  const fetchTableInformation = async (tableId, isNewTableAdded, tableList) => {
    const tableDetails = findTableDetailsWithTableList(tableId, tableList);
    if (tableDetails?.table_name) {
      const { table_name } = tableDetails;
      const { error, data } = await tooljetDatabaseService.viewTable(organizationId, table_name);

      if (error) {
        toast.error(error?.message ?? 'Failed to fetch table information');
        return;
      }

      if (data?.result?.columns?.length > 0) {
        const columnList = data?.result?.columns.map(({ column_name, data_type, keytype, ...rest }) => ({
          Header: column_name,
          accessor: column_name,
          dataType: data_type,
          isPrimaryKey: keytype?.toLowerCase() === 'primary key',
          ...rest,
        }));
        setColumns(columnList);
        setTableInfo((prevTableInfo) => ({ ...prevTableInfo, [table_name]: columnList }));

        setTableForeignKeyInfo((fk_info) => ({
          ...fk_info,
          [table_name]: data?.result?.foreign_keys || [],
        }));

        if (isNewTableAdded) {
          setJoinTableOptions((joinOptions) => {
            const { fields } = joinOptions;
            const newFields = deepClone(fields).filter((field) => field.table !== tableId);
            newFields.push(
              ...(data?.result?.columns
                ? data.result.columns.map((col) => ({
                    name: col.column_name,
                    table: tableId,
                    // alias: `${tableId}_${col.column_name}`,
                  }))
                : [])
            );

            return {
              ...joinOptions,
              fields: newFields,
            };
          });
        }
      }
    }
  };

  const generateListForDropdown = (tableList) => {
    return tableList.map((tableMap) =>
      Object.fromEntries([
        ['label', tableMap.table_name],
        ['value', tableMap.table_id],
      ])
    );
  };

  const handleTableNameSelect = (tableId) => {
    setSelectedTableId(tableId);
    fetchTableInformation(tableId, true, tables);
    optionchanged('table_id', tableId);

    setJoinTableOptions(() => {
      return {
        joins: [
          {
            id: new Date().getTime(),
            conditions: {
              operator: 'AND',
              conditionsList: [
                {
                  operator: '=',
                  leftField: { table: tableId },
                },
              ],
            },
            joinType: 'INNER',
          },
        ],
        from: {
          name: tableId,
          type: 'Table',
        },
        fields: [],
      };
    });
  };

  //Following ref is responsible to hold the value of prev operation while shifting between the active tabs
  const [prevOperationBetweenModeChange, setPrevOperationBetweenModeChange] = useState(null);

  const handleTabClick = (mode) => {
    const optionsToUpdate = {
      activeTab: mode,
    };
    if (mode === 'SQL mode') {
      // prevOperationBetweenModeChange.current = options?.operation;
      setPrevOperationBetweenModeChange(options?.operation || '');
      optionsToUpdate['operation'] = 'sql_execution';
      optionsToUpdate['organization_id'] = organizationId;
    } else {
      optionsToUpdate['operation'] = prevOperationBetweenModeChange ?? '';
    }
    optionsChanged(optionsToUpdate);
    setActiveTab(mode);
  };

  const getComponent = () => {
    switch (operation) {
      case 'list_rows':
        return ListRows;
      case 'create_row':
        return CreateRow;
      case 'update_rows':
        return UpdateRows;
      case 'delete_rows':
        return DeleteRows;
      case 'join_tables':
        return JoinTable;
    }
  };

  const tooljetDbOperationList = [
    { label: 'List rows', value: 'list_rows' },
    { label: 'Create row', value: 'create_row' },
    { label: 'Update rows', value: 'update_rows' },
    { label: 'Delete rows', value: 'delete_rows' },
    { label: 'Join tables', value: 'join_tables' },
  ];

  const ComponentToRender = getComponent(operation);

  return (
    <TooljetDatabaseContext.Provider value={value}>
      {/* table name dropdown */}

      <div className={cx({ 'col-4': !isHorizontalLayout, 'd-flex tooljetdb-worflow-operations': isHorizontalLayout })}>
        <label className={cx('form-label', 'flex-shrink-0')}>Mode</label>
        <div
          className={cx('d-flex align-items-center justify-content-start gap-2', {
            'row-tabs-dark': darkMode,
            'row-tabs': !darkMode,
          })}
        >
          <div
            onClick={() => handleTabClick('GUI mode')}
            style={{
              backgroundColor:
                activeTab === 'GUI mode' && !darkMode
                  ? 'white'
                  : activeTab === 'GUI mode' && darkMode
                  ? '#242f3c'
                  : 'transparent',
              color:
                activeTab === 'GUI mode' && !darkMode
                  ? '#3E63DD'
                  : activeTab === 'GUI mode' && darkMode
                  ? 'white'
                  : '#687076',
            }}
            className="row-tab-content"
          >
            GUI mode
          </div>

          <div
            onClick={() => handleTabClick('SQL mode')}
            style={{
              backgroundColor:
                activeTab === 'SQL mode' && !darkMode
                  ? 'white'
                  : activeTab === 'SQL mode' && darkMode
                  ? '#242f3c'
                  : 'transparent',
              color:
                activeTab === 'SQL mode' && !darkMode
                  ? '#3E63DD'
                  : activeTab === 'SQL mode' && darkMode
                  ? 'white'
                  : '#687076',
            }}
            className="row-tab-content"
          >
            SQL mode
          </div>
        </div>
      </div>

      {activeTab === 'GUI mode' && (
        <>
          <div className={cx({ row: !isHorizontalLayout, 'my-3': isHorizontalLayout })}>
            <div
              className={cx({
                'col-4': !isHorizontalLayout,
                'd-flex tooljetdb-worflow-operations': isHorizontalLayout,
              })}
            >
              <label className={cx('form-label', 'flex-shrink-0')}>Table name</label>
              <div
                className={cx(
                  { 'flex-grow-1': isHorizontalLayout },
                  'border',
                  'rounded',
                  'overflow-hidden',
                  'minw-400-w-400'
                )}
              >
                <DropDownSelect
                  customBorder={false}
                  showPlaceHolder
                  options={generateListForDropdown(tables)}
                  darkMode={darkMode}
                  onChange={(value) => {
                    value?.value && handleTableNameSelect(value?.value);
                  }}
                  onAdd={() => navigate(getPrivateRoute('database'))}
                  addBtnLabel={'Add new table'}
                  value={generateListForDropdown(tables).find((val) => val?.value === selectedTableId)}
                />
              </div>
            </div>
          </div>

          {/* operation selection dropdown */}
          <div className={cx('my-3 py-1', { row: !isHorizontalLayout })}>
            <div
              /* className="my-2 col-4"  */
              className={cx({
                'col-4': !isHorizontalLayout,
                'd-flex tooljetdb-worflow-operations': isHorizontalLayout,
              })}
            >
              <label className={cx('form-label', 'flex-shrink-0')}>Operations</label>
              <div
                className={cx(
                  { 'flex-grow-1': isHorizontalLayout },
                  'border',
                  'rounded',
                  'overflow-hidden',
                  'minw-400-w-400'
                )}
              >
                <DropDownSelect
                  showPlaceHolder
                  options={tooljetDbOperationList}
                  darkMode={darkMode}
                  onChange={(value) => {
                    value?.value && setOperation(value?.value);
                  }}
                  value={tooljetDbOperationList.find((val) => val?.value === operation)}
                />
              </div>
            </div>
          </div>

          {/* component to render based on the operation */}
          {ComponentToRender && (
            <ComponentToRender
              currentState={currentState}
              s
              options={options}
              optionchanged={optionchanged}
              darkMode={darkMode}
            />
          )}
        </>
      )}
      {activeTab === 'SQL mode' && (
        <div className={cx('mt-3', { 'col-4': !isHorizontalLayout, 'd-flex': isHorizontalLayout })}>
          <label className="form-label flex-shrink-0" style={{ minWidth: '100px' }}></label>
          <CodeHinter
            type="multiline"
            initialValue={options?.sql_execution?.sqlQuery ?? 'SELECT * from users'}
            lang="sql"
            height={150}
            onChange={(value) => {
              optionchanged('sql_execution', { sqlQuery: value });
            }}
            componentName="TooljetDatabase"
            delayOnChange={false}
          />
        </div>
      )}
    </TooljetDatabaseContext.Provider>
  );
};

export default ToolJetDbOperations;
