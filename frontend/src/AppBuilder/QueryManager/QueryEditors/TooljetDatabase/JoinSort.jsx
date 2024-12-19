import React, { useContext } from 'react';
import { Col, Row } from 'react-bootstrap';
import { TooljetDatabaseContext } from '@/TooljetDatabase/index';
import DropDownSelect from './DropDownSelect';
import { ButtonSolid } from '@/_ui/AppButton/AppButton';
import Trash from '@/_ui/Icon/solidIcons/Trash';
import AddRectangle from '@/_ui/Icon/bulkIcons/AddRectangle';
import { isEmpty } from 'lodash';
import { NoCondition } from './NoConditionUI';
import CodeHinter from '@/AppBuilder/CodeEditor';
import { ToolTip } from '@/_components';

export default function JoinSort({ darkMode }) {
  const { tableInfo, joinOrderByOptions, setJoinOrderByOptions, joinOptions, findTableDetails } =
    useContext(TooljetDatabaseContext);

  const tableSet = new Set();
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
  const tableList = [];

  tables.forEach((tableId) => {
    const tableDetails = findTableDetails(tableId);
    if (tableDetails?.table_name && tableInfo[tableDetails.table_name]) {
      const tableDetailsForDropDown = {
        label: tableDetails.table_name,
        value: tableId,
        options:
          tableInfo[tableDetails.table_name]?.map((columns) => ({
            label: columns.Header,
            value: columns.Header + '_' + tableId,
            table: tableId,
            icon: columns.dataType,
          })) || [],
      };
      tableList.push(tableDetailsForDropDown);
    }
  });

  const sortbyConstants = [
    { label: 'Ascending', value: 'ASC' },
    { label: 'Descending', value: 'DESC' },
  ];

  return (
    <div className="p-0">
      {isEmpty(joinOrderByOptions) ? (
        <NoCondition />
      ) : (
        joinOrderByOptions.map((options, i) => {
          const tableDetails = options?.table ? findTableDetails(options?.table) : '';
          const isColumnJsonbType =
            tableInfo[tableDetails?.table_name]?.find((col) => col.accessor === options?.columnName).dataType ===
            'jsonb';
          return (
            <Row className="mb-2 mx-0 " key={i}>
              <Col sm="6" className="p-0">
                <DropDownSelect
                  buttonClasses={`border ${
                    isColumnJsonbType ? 'rounded-top-left' : 'rounded rounded-top-right-0 rounded-bottom-right-0'
                  }   overflow-hidden`}
                  showPlaceHolder
                  options={tableList}
                  darkMode={darkMode}
                  value={{
                    value: options?.columnName && options.table ? options.columnName + '_' + options.table : '',
                    label: tableDetails?.table_name
                      ? tableDetails?.table_name + '.' + options.columnName
                      : options.columnName,
                    table: options.table,
                  }}
                  onChange={(option) => {
                    setJoinOrderByOptions(
                      joinOrderByOptions.map((sortBy, index) => {
                        if (i === index) {
                          return {
                            ...sortBy,
                            columnName: option?.label,
                            table: option.table,
                          };
                        }
                        return sortBy;
                      })
                    );
                  }}
                />
                {isColumnJsonbType && (
                  <div className="tjdb-codehinter-jsonpath">
                    <ToolTip
                      message={
                        options?.jsonpath
                          ? options.jsonpath
                          : 'Access nested JSON fields by using -> for JSON object and ->> for text'
                      }
                      tooltipClassName="tjdb-table-tooltip"
                      placement="top"
                      trigger={['hover', 'focus']}
                      width="160px"
                    >
                      <span>
                        <CodeHinter
                          type="basic"
                          initialValue={options?.jsonpath || ''}
                          lang="javascript"
                          onChange={(value) => {
                            setJoinOrderByOptions(
                              joinOrderByOptions.map((sortBy, index) => {
                                if (i === index) {
                                  return {
                                    ...sortBy,
                                    jsonpath: value,
                                  };
                                }
                                return sortBy;
                              })
                            );
                          }}
                          enablePreview={false}
                          height="30"
                          placeholder="->>'key'"
                          componentName={options?.columnName ? `{}${options.columnName}` : ''}
                        />
                      </span>
                    </ToolTip>
                  </div>
                )}
              </Col>
              <Col sm="6" className="p-0 d-flex">
                <div className="flex-grow-1">
                  <DropDownSelect
                    buttonClasses="border border-start-0 border-end-0 overflow-hidden"
                    showPlaceHolder
                    options={sortbyConstants}
                    darkMode={darkMode}
                    value={sortbyConstants.find((opt) => opt.value === options.direction)}
                    onChange={(option) => {
                      setJoinOrderByOptions(
                        joinOrderByOptions.map((sortBy, index) => {
                          if (i === index) {
                            return {
                              ...sortBy,
                              direction: option?.value,
                            };
                          }
                          return sortBy;
                        })
                      );
                    }}
                  />
                </div>
                <ButtonSolid
                  size="sm"
                  variant="ghostBlack"
                  className="px-1 rounded-0 border rounded-end"
                  customStyles={{
                    height: '30px',
                  }}
                  onClick={() => setJoinOrderByOptions(joinOrderByOptions.filter((opt, idx) => idx !== i))}
                >
                  <Trash fill="var(--slate9)" style={{ height: '16px' }} />
                </ButtonSolid>
              </Col>
            </Row>
          );
        })
      )}
      {/* Dynamically render below Row */}
      <Row className="mx-1 mb-1">
        <Col className="p-0">
          <ButtonSolid variant="ghostBlue" size="sm" onClick={() => setJoinOrderByOptions([...joinOrderByOptions, {}])}>
            <AddRectangle width="15" fill="#3E63DD" opacity="1" secondaryFill="#ffffff" />
            &nbsp;&nbsp; Add more
          </ButtonSolid>
        </Col>
      </Row>
    </div>
  );
}