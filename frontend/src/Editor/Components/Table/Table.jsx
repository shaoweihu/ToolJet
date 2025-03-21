/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState, useEffect, useCallback, useContext, useReducer, useRef } from 'react';
import {
  useTable,
  useFilters,
  useSortBy,
  useGlobalFilter,
  useAsyncDebounce,
  usePagination,
  useBlockLayout,
  useResizeColumns,
  useRowSelect,
  useColumnOrder,
} from 'react-table';
import cx from 'classnames';
import {
  resolveReferences,
  validateWidget,
  determineJustifyContentValue,
  resolveWidgetFieldValue,
} from '@/_helpers/utils';
import useStore from '@/AppBuilder/_stores/store';
import { shallow } from 'zustand/shallow';
import { useExportData } from 'react-table-plugins';
import Papa from 'papaparse';
import { Pagination } from './Pagination';
import { Filter } from './Filter';
import { GlobalFilter } from './GlobalFilter';
var _ = require('lodash');
import loadPropertiesAndStyles from './load-properties-and-styles';
import { reducer, reducerActions, initialState } from './reducer';
import customFilter from './custom-filter';
import generateColumnsData from './columns';
import generateActionsData from './columns/actions';
import autogenerateColumns from './columns/autogenerateColumns';
import IndeterminateCheckbox from './IndeterminateCheckbox';
// eslint-disable-next-line import/no-unresolved
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line import/no-unresolved
import JsPDF from 'jspdf';
// eslint-disable-next-line import/no-unresolved
import 'jspdf-autotable';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
// eslint-disable-next-line import/no-unresolved
import { IconEyeOff } from '@tabler/icons-react';
// eslint-disable-next-line import/no-unresolved
import * as XLSX from 'xlsx/xlsx.mjs';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover from 'react-bootstrap/Popover';
import { useMounted } from '@/_hooks/use-mount';
import GenerateEachCellValue from './GenerateEachCellValue';
// eslint-disable-next-line import/no-unresolved
import { toast } from 'react-hot-toast';
import { Tooltip } from 'react-tooltip';
import { AddNewRowComponent } from './AddNewRowComponent';
import { useAppInfo } from '@/_stores/appDataStore';
import { ButtonSolid } from '@/_ui/AppButton/AppButton';
import SolidIcon from '@/_ui/Icon/SolidIcons';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { OverlayTriggerComponent } from './OverlayTriggerComponent';
// eslint-disable-next-line import/no-unresolved
import { diff } from 'deep-object-diff';
import { isRowInValid } from '../tableUtils';
import moment from 'moment';
import { deepClone } from '@/_helpers/utilities/utils.helpers';

// utilityForNestedNewRow function is used to construct nested object while adding or updating new row when '.' is present in column key for adding new row
const utilityForNestedNewRow = (row) => {
  let arr = Object.keys(row);
  let obj = {};
  arr.forEach((key) => {
    let nestedKeys = key.split('.');
    let tempObj = obj;

    for (let i = 0; i < nestedKeys.length; i++) {
      let nestedKey = nestedKeys[i];

      if (!tempObj.hasOwnProperty(nestedKey)) {
        tempObj[nestedKey] = i === nestedKeys.length - 1 ? '' : {};
      }

      tempObj = tempObj[nestedKey];
    }
  });
  return obj;
};

export function Table({
  id,
  width,
  height,
  component,
  onComponentClick,
  currentState = { components: {} },
  onEvent,
  paramUpdated,
  changeCanDrag,
  onComponentOptionChanged,
  onComponentOptionsChanged,
  darkMode,
  fireEvent,
  setExposedVariable,
  setExposedVariables,
  styles,
  properties,
  variablesExposedForPreview,
  exposeToCodeHinter,
  // events,
  setProperty,
  mode,
}) {
  const {
    color,
    serverSidePagination,
    serverSideSearch,
    serverSideSort,
    serverSideFilter,
    displaySearchBox,
    showDownloadButton,
    showFilterButton,
    showBulkUpdateActions,
    showBulkSelector,
    highlightSelectedRow,
    loadingState,
    columnSizes,
    tableType,
    cellSize,
    borderRadius,
    parsedWidgetVisibility,
    parsedDisabledState,
    actionButtonRadius,
    actions,
    enableNextButton,
    enablePrevButton,
    totalRecords,
    rowsPerPage,
    enabledSort,
    hideColumnSelectorButton,
    defaultSelectedRow,
    showAddNewRowButton,
    allowSelection,
    enablePagination,
    maxRowHeight,
    autoHeight,
    selectRowOnCellEdit,
    contentWrapProperty,
    boxShadow,
    maxRowHeightValue,
    borderColor,
    isMaxRowHeightAuto,
    columnHeaderWrap,
  } = loadPropertiesAndStyles(properties, styles, darkMode, component);
  const exposedVariables = useStore((state) => state.getExposedValueOfComponent(id), shallow);
  const updatedDataReference = useRef([]);
  const preSelectRow = useRef(false);
  const initialPageCountRef = useRef(null);
  const { events: allAppEvents } = useAppInfo();

  const tableEvents = allAppEvents.filter((event) => event.target === 'component' && event.sourceId === id);
  const tableColumnEvents = allAppEvents.filter((event) => event.target === 'table_column' && event.sourceId === id);
  const tableActionEvents = allAppEvents.filter((event) => event.target === 'table_action' && event.sourceId === id);

  const getItemStyle = ({ isDragging, isDropAnimating }, draggableStyle) => ({
    ...draggableStyle,
    userSelect: 'none',
    background: isDragging ? 'var(--slate4)' : '',
    top: 'auto',
    borderRadius: '4px',
    ...(isDragging && {
      // marginLeft: '-280px', // hack changing marginLeft to -280px to bring the draggable header to the correct position at the start of drag
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '10px',
      height: '30px',
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '9999',
      width: '60px',
    }),
    ...(!isDragging && { transform: 'translate(0,0)', width: '100%' }),
    ...(isDropAnimating && { transitionDuration: '0.001s' }),
  });
  const { t } = useTranslation();

  const [tableDetails, dispatch] = useReducer(reducer, initialState());
  const [hoverAdded, setHoverAdded] = useState(false);
  const [generatedColumn, setGeneratedColumn] = useState([]);
  const [isCellValueChanged, setIsCellValueChanged] = useState(false);
  const [ tableButtonHoveredId, setTableButtonHoveredId ] = useState("");

  const mergeToTableDetails = (payload) => dispatch(reducerActions.mergeToTableDetails(payload));
  const mergeToFilterDetails = (payload) => dispatch(reducerActions.mergeToFilterDetails(payload));
  const mergeToAddNewRowsDetails = (payload) => dispatch(reducerActions.mergeToAddNewRowsDetails(payload));
  const mounted = useMounted();
  const [resizingColumnId, setResizingColumnId] = useState(null);

  const prevDataFromProps = useRef();
  useEffect(() => {
    if (mounted) prevDataFromProps.current = properties.data;
  }, [JSON.stringify(properties.data)]);

  useEffect(() => {
    setExposedVariable(
      'filters',
      tableDetails.filterDetails.filters.map((filter) => filter.value)
    );
  }, [JSON.stringify(tableDetails?.filterDetails?.filters)]);

  useEffect(
    () => mergeToTableDetails({ columnProperties: component?.definition?.properties?.columns?.value }),
    [component?.definition?.properties]
  );

  useEffect(() => {
    const hoverEvent = tableEvents?.find(({ event }) => {
      return event?.eventId == 'onRowHovered';
    });

    if (hoverEvent?.event?.eventId) {
      setHoverAdded(true);
    }
  }, [JSON.stringify(tableEvents)]);

  function showFilters() {
    mergeToFilterDetails({ filtersVisible: true });
  }

  function hideFilters() {
    mergeToFilterDetails({ filtersVisible: false });
  }

  function showAddNewRowPopup() {
    mergeToAddNewRowsDetails({ addingNewRows: true });
  }

  function hideAddNewRowPopup() {
    mergeToAddNewRowsDetails({ addingNewRows: false });
  }

  const defaultColumn = React.useMemo(
    () => ({
      minWidth: 60,
      width: 150,
    }),
    []
  );

  function handleExistingRowCellValueChange(index, key, value, rowData) {
    const changeSet = tableDetails.changeSet;
    setIsCellValueChanged(true);

    const dataUpdates = tableDetails.dataUpdates || [];
    const clonedTableData = deepClone(tableData);

    let obj = changeSet ? changeSet[index] || {} : {};
    obj = _.set(obj, key, value);

    let newChangeset = {
      ...changeSet,
      [index]: {
        ...obj,
      },
    };

    obj = _.set({ ...rowData }, key, value);

    let newDataUpdates = {
      ...dataUpdates,
      [index]: { ...obj },
    };

    Object.keys(newChangeset).forEach((key) => {
      clonedTableData[key] = {
        ..._.merge(clonedTableData[key], newChangeset[key]),
      };
    });
    const changesToBeSavedAndExposed = { dataUpdates: newDataUpdates, changeSet: newChangeset };
    mergeToTableDetails(changesToBeSavedAndExposed);
    fireEvent('onCellValueChanged');
    return setExposedVariables({ ...changesToBeSavedAndExposed, updatedData: clonedTableData });
  }

  const copyOfTableDetails = useRef(tableDetails);
  useEffect(() => {
    copyOfTableDetails.current = deepClone(tableDetails);
  }, [JSON.stringify(tableDetails)]);

  function handleNewRowCellValueChange(index, key, value, rowData) {
    setIsCellValueChanged(true);
    const changeSet = copyOfTableDetails.current.addNewRowsDetails.newRowsChangeSet || {};
    const dataUpdates = copyOfTableDetails.current.addNewRowsDetails.newRowsDataUpdates || {};
    let obj = changeSet ? changeSet[index] || {} : {};
    obj = _.set(obj, key, value);
    let newChangeset = {
      ...changeSet,
      [index]: {
        ...obj,
      },
    };

    if (Object.keys(rowData).find((key) => key.includes('.'))) {
      rowData = utilityForNestedNewRow(rowData);
    }
    obj = _.merge({}, rowData, obj);

    let newDataUpdates = {
      ...dataUpdates,
      [index]: { ...obj },
    };
    const changesToBeSaved = { newRowsDataUpdates: newDataUpdates, newRowsChangeSet: newChangeset };
    const changesToBeExposed = Object.keys(newDataUpdates).reduce((accumulator, row) => {
      accumulator.push({ ...newDataUpdates[row] });
      return accumulator;
    }, []);
    mergeToAddNewRowsDetails(changesToBeSaved);
    return setExposedVariables({ newRows: changesToBeExposed });
  }

  function getExportFileBlob({ columns, fileType, fileName }) {
    let headers = columns.map((column) => {
      return { exportValue: String(column?.exportValue), key: column.key ? String(column.key) : column?.key };
    });
    let data = globalFilteredRows.map((row) => {
      return headers.reduce((accumulator, header) => {
        let value = undefined;
        if (header.key && header.key !== header.exportValue) {
          value = _.get(row.original, header.key);
        } else {
          value = _.get(row.original, header.exportValue);
        }
        accumulator.push(value);
        return accumulator;
      }, []);
    });
    headers = headers.map((header) => header.exportValue.toUpperCase());
    if (fileType === 'csv') {
      const csvString = Papa.unparse({ fields: headers, data });
      return new Blob([csvString], { type: 'text/csv' });
    } else if (fileType === 'pdf') {
      const pdfData = data.map((obj) => Object.values(obj));
      const doc = new JsPDF();
      doc.autoTable({
        head: [headers],
        body: pdfData,
        styles: {
          minCellHeight: 9,
          minCellWidth: 20,
          fontSize: 11,
          color: 'black',
        },
        theme: 'grid',
      });
      doc.save(`${fileName}.pdf`);
      return;
    } else if (fileType === 'xlsx') {
      data.unshift(headers); //adding headers array at the beginning of data
      let wb = XLSX.utils.book_new();
      let ws1 = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws1, 'React Table Data');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      // Returning false as downloading of file is already taken care of
      return false;
    }
  }

  function getExportFileName() {
    return `${component?.name}_${moment().format('DD-MM-YYYY_HH-mm')}`;
  }

  function onPageIndexChanged(page) {
    onComponentOptionChanged(component, 'pageIndex', page).then(() => {
      onEvent('onPageChanged', tableEvents, { component });
    });
  }

  function handleChangesSaved() {
    const clonedTableData = deepClone(tableData);
    Object.keys(changeSet).forEach((key) => {
      clonedTableData[key] = {
        ..._.merge(clonedTableData[key], changeSet[key]),
      };
    });
    updatedDataReference.current = deepClone(clonedTableData);

    setExposedVariables({
      changeSet: {},
      dataUpdates: [],
    });
    mergeToTableDetails({ dataUpdates: {}, changeSet: {} });
  }

  function handleChangesDiscarded() {
    setExposedVariables({
      changeSet: {},
      dataUpdates: [],
    });
    mergeToTableDetails({ dataUpdates: {}, changeSet: {} });
    fireEvent('onCancelChanges');
  }

  const changeSet = tableDetails?.changeSet ?? {};

  const computeFontColor = useCallback(() => {
    if (color !== undefined) {
      return color;
    } else {
      return darkMode ? '#ffffff' : '#000000';
    }
  }, [color, darkMode]);

  let tableData = [],
    dynamicColumn = [];

  const useDynamicColumn = resolveWidgetFieldValue(component.definition.properties?.useDynamicColumn?.value);
  if (currentState) {
    tableData = resolveWidgetFieldValue(component.definition.properties.data.value);
    dynamicColumn = useDynamicColumn
      ? resolveWidgetFieldValue(component.definition.properties?.columnData?.value) ?? []
      : [];
    if (!Array.isArray(tableData)) {
      tableData = [];
    } else {
      tableData = tableData.filter((data) => data !== null && data !== undefined);
    }
  }

  tableData = _.isArray(tableData) ? tableData : [];

  const tableRef = useRef();

  const removeNullValues = (arr) => arr.filter((element) => element !== null);

  const columnProperties = useDynamicColumn
    ? generatedColumn
    : removeNullValues(component.definition.properties.columns.value);

  let columnData = generateColumnsData({
    columnProperties,
    columnSizes,
    currentState,
    handleCellValueChange: handleExistingRowCellValueChange,
    customFilter,
    defaultColumn,
    changeSet: tableDetails.changeSet,
    tableData,
    variablesExposedForPreview,
    exposeToCodeHinter,
    id,
    fireEvent,
    tableRef,
    t,
    darkMode,
    tableColumnEvents: tableColumnEvents,
    cellSize: cellSize,
    maxRowHeightValue: maxRowHeightValue,
    isMaxRowHeightAuto: isMaxRowHeightAuto,
  });

  columnData = useMemo(
    () =>
      columnData.filter((column) => {
        if (resolveReferences(column?.columnVisibility)) {
          return column;
        }
      }),
    [columnData, currentState]
  );

  const transformations = columnProperties
    .filter((column) => column.transformation && column.transformation != '{{cellValue}}')
    .map((column) => ({
      key: column.key ? column.key : column.name,
      transformation: column.transformation,
    }));

  tableData = useMemo(() => {
    return tableData.map((row) => {
      const transformedObject = {};

      transformations.forEach(({ key, transformation }) => {
        const nestedKeys = key.includes('.') && key.split('.');
        if (nestedKeys) {
          // Single-level nested property
          const [nestedKey, subKey] = nestedKeys;
          const nestedObject = transformedObject?.[nestedKey] || { ...row[nestedKey] }; // Retain existing nested object
          const newValue = resolveReferences(transformation, undefined, row[key], {
            cellValue: row?.[nestedKey]?.[subKey],
            rowData: row,
          });

          // Apply transformation to subKey
          nestedObject[subKey] = newValue;

          // Update transformedObject with the new nested object
          transformedObject[nestedKey] = nestedObject;
        } else {
          // Non-nested property
          transformedObject[key] = resolveReferences(transformation, undefined, row[key], {
            cellValue: row[key],
            rowData: row,
          });
        }
      });

      return {
        ...row,
        ...transformedObject,
      };
    });
  }, [JSON.stringify([tableData, transformations, currentState])]);

  useEffect(() => {
    setExposedVariables({
      currentData: tableData,
      updatedData: tableData,
    });
  }, [JSON.stringify(tableData)]);

  const columnDataForAddNewRows = generateColumnsData({
    columnProperties: useDynamicColumn ? generatedColumn : component.definition.properties.columns.value,
    columnSizes,
    currentState,
    handleCellValueChange: handleNewRowCellValueChange,
    customFilter,
    defaultColumn,
    changeSet: tableDetails.addNewRowsDetails.newRowsChangeSet,
    tableData,
    variablesExposedForPreview,
    exposeToCodeHinter,
    id,
    fireEvent,
    tableRef,
    t,
    darkMode,
  });
  const [leftActionsCellData, rightActionsCellData] = useMemo(
    () =>
      generateActionsData({
        actions,
        columnSizes,
        defaultColumn,
        fireEvent,
        setExposedVariables,
        tableActionEvents,
      }),
    [JSON.stringify(actions), tableActionEvents]
  );

  const textWrapActions = (id) => {
    //should we remove this
    let wrapOption = tableDetails.columnProperties?.find((item) => {
      return item?.id == id;
    });
    return wrapOption?.textWrap;
  };

  const optionsData = columnData.map((column) => column?.columnOptions?.selectOptions);
  const columns = useMemo(
    () => {
      return [...leftActionsCellData, ...columnData, ...rightActionsCellData];
    },
    [
      JSON.stringify(columnData),
      JSON.stringify(tableData),
      JSON.stringify(actions),
      leftActionsCellData.length,
      rightActionsCellData.length,
      tableDetails.changeSet,
      JSON.stringify(optionsData),
      JSON.stringify(component.definition.properties.columns),
      showBulkSelector,
      JSON.stringify(variablesExposedForPreview && variablesExposedForPreview[id]),
      darkMode,
      allowSelection,
      highlightSelectedRow,
      JSON.stringify(tableActionEvents),
      JSON.stringify(tableColumnEvents),
      maxRowHeightValue,
      isMaxRowHeightAuto,
    ] // Hack: need to fix
  );

  const columnsForAddNewRow = useMemo(() => {
    return [...columnDataForAddNewRows];
  }, [JSON.stringify(columnDataForAddNewRows), darkMode, tableDetails.addNewRowsDetails.addingNewRows]);

  const data = useMemo(() => {
    if (!_.isEqual(properties.data, prevDataFromProps.current)) {
      if (!_.isEmpty(updatedDataReference.current)) updatedDataReference.current = [];
      if (
        !_.isEmpty(exposedVariables.newRows) ||
        !_.isEmpty(tableDetails.addNewRowsDetails.newRowsDataUpdates) ||
        tableDetails.addNewRowsDetails.addingNewRows
      ) {
        setExposedVariable('newRows', []);
        mergeToAddNewRowsDetails({ newRowsDataUpdates: {}, newRowsChangeSet: {}, addingNewRows: false });
      }
    }
    return _.isEmpty(updatedDataReference.current) ? tableData : updatedDataReference.current;
  }, [tableData.length, component.definition.properties.data.value, JSON.stringify([properties.data, tableData])]);

  useEffect(() => {
    if (
      tableData.length != 0 &&
      component.definition.properties.autogenerateColumns?.value &&
      (useDynamicColumn || mode === 'edit' || mode === 'view')
    ) {
      const generatedColumnFromData = autogenerateColumns(
        tableData,
        component.definition.properties.columns.value,
        component.definition.properties?.columnDeletionHistory?.value ?? [],
        useDynamicColumn,
        dynamicColumn,
        setProperty,
        component.definition.properties.autogenerateColumns?.generateNestedColumns ?? false
      );

      useDynamicColumn && setGeneratedColumn(generatedColumnFromData);
    }
  }, [JSON.stringify(tableData), JSON.stringify(dynamicColumn)]);

  const computedStyles = {
    // width: `${width}px`,
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    gotoPage,
    pageCount,
    nextPage,
    previousPage,
    setPageSize,
    state,
    rows,
    prepareRow,
    setAllFilters,
    preGlobalFilteredRows,
    setGlobalFilter,
    allColumns,
    setColumnOrder,
    state: { pageIndex, globalFilter },
    exportData,
    selectedFlatRows,
    globalFilteredRows,
    getToggleHideAllColumnsProps,
    toggleRowSelected,
    toggleAllRowsSelected,
  } = useTable(
    {
      autoResetPage: false,
      autoResetGlobalFilter: false,
      autoResetHiddenColumns: false,
      autoResetFilters: false,
      manualGlobalFilter: serverSideSearch,
      manualFilters: serverSideFilter,
      columns,
      data,
      defaultColumn,
      initialState: { pageIndex: 0, pageSize: 1 },
      pageCount: initialPageCountRef.current,
      manualPagination: serverSidePagination,
      getExportFileBlob,
      getExportFileName,
      disableSortBy: !enabledSort,
      manualSortBy: serverSideSort,
      stateReducer: (newState, action, prevState) => {
        const newStateWithPrevSelectedRows = showBulkSelector
          ? { ...newState, selectedRowId: { ...prevState.selectedRowIds, ...newState.selectedRowIds } }
          : { ...newState.selectedRowId };
        if (action.type === 'toggleRowSelected') {
          prevState.selectedRowIds[action.id]
            ? (newState.selectedRowIds = {
                ...newStateWithPrevSelectedRows.selectedRowIds,
                [action.id]: false,
              })
            : (newState.selectedRowIds = {
                ...newStateWithPrevSelectedRows.selectedRowIds,
                [action.id]: true,
              });
        }
        return newState;
      },
    },
    useColumnOrder,
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination,
    useBlockLayout,
    useResizeColumns,
    useExportData,
    useRowSelect,
    (hooks) => {
      allowSelection &&
        !highlightSelectedRow &&
        hooks.visibleColumns.push((columns) => [
          {
            id: 'selection',
            Header: ({ getToggleAllPageRowsSelectedProps }) => {
              return (
                <div className="d-flex flex-column align-items-center">
                  {showBulkSelector && <IndeterminateCheckbox {...getToggleAllPageRowsSelectedProps()} />}
                </div>
              );
            },
            Cell: ({ row }) => {
              return (
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                  <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} fireEvent={fireEvent} />
                </div>
              );
            },
            width: 1,
            columnType: 'selector',
          },
          ...columns,
        ]);
    }
  );
  const currentColOrder = React.useRef();
  const clientSidePagination = enablePagination && !serverSidePagination;
  const sortOptions = useMemo(() => {
    if (state?.sortBy?.length === 0) {
      return;
    }

    const columnName = columns.find((column) => column.id === state?.sortBy?.[0]?.id).accessor;

    return [
      {
        column: columnName,
        direction: state?.sortBy?.[0]?.desc ? 'desc' : 'asc',
      },
    ];
  }, [JSON.stringify(state)]);

  const getDetailsOfPreSelectedRow = () => {
    const key = Object?.keys(defaultSelectedRow)[0] ?? '';
    const value = defaultSelectedRow?.[key] ?? undefined;
    const preSelectedRowDetails = rows.find((row) => row?.original?.[key] === value);
    return preSelectedRowDetails;
  };

  useEffect(() => {
    if (!sortOptions) {
      setExposedVariable('sortApplied', []);
    }
    if (mounted) {
      setExposedVariable('sortApplied', sortOptions);
      fireEvent('onSort');
    }
  }, [JSON.stringify(sortOptions)]);

  useEffect(() => {
    setExposedVariable('setPage', async function (targetPageIndex) {
      setPaginationInternalPageIndex(targetPageIndex);
      setExposedVariable('pageIndex', targetPageIndex);
      if (!serverSidePagination && clientSidePagination) gotoPage(targetPageIndex - 1);
    });
  }, [serverSidePagination, clientSidePagination, setPaginationInternalPageIndex]);

  useEffect(() => {
    setExposedVariable('selectRow', async function (key, value) {
      const item = tableData.filter((item) => item[key] == value);
      const row = rows.find((item, index) => item.original[key] == value);
      if (row != undefined) {
        const selectedRowDetails = { selectedRow: item[0], selectedRowId: row.id };
        setExposedVariables(selectedRowDetails);
        toggleRowSelected(row.id);
        mergeToTableDetails(selectedRowDetails);
        fireEvent('onRowClicked');
      }
    });
  }, [JSON.stringify(tableData), JSON.stringify(tableDetails.selectedRow)]);

  useEffect(() => {
    setExposedVariable('deselectRow', async function () {
      if (!_.isEmpty(tableDetails.selectedRow)) {
        const selectedRowDetails = { selectedRow: {}, selectedRowId: {} };
        setExposedVariables(selectedRowDetails);
        if (allowSelection && !showBulkSelector) toggleRowSelected(tableDetails.selectedRowId, false);
        mergeToTableDetails(selectedRowDetails);
      }
      return;
    });
  }, [JSON.stringify(tableData), JSON.stringify(tableDetails.selectedRow)]);

  useEffect(() => {
    setExposedVariable('discardChanges', async function () {
      if (Object.keys(tableDetails.changeSet || {}).length > 0) {
        setExposedVariables({
          changeSet: {},
          dataUpdates: [],
        });
        mergeToTableDetails({ dataUpdates: {}, changeSet: {} });
      }
    });
  }, [JSON.stringify(tableData), JSON.stringify(tableDetails.changeSet)]);

  useEffect(() => {
    setExposedVariable('discardNewlyAddedRows', async function () {
      if (
        !_.isEmpty(exposedVariables.newRows) ||
        !_.isEmpty(tableDetails.addNewRowsDetails.newRowsChangeSet) ||
        !_.isEmpty(tableDetails.addNewRowsDetails.newRowsChangeSet)
      ) {
        setExposedVariables({
          newRows: [],
        });
        mergeToAddNewRowsDetails({ newRowsChangeSet: {}, newRowsDataUpdates: {}, addingNewRows: false });
      }
    });
  }, [
    JSON.stringify(tableDetails.addNewRowsDetails.newRowsChangeSet),
    tableDetails.addNewRowsDetails.addingNewRows,
    JSON.stringify(tableDetails.addNewRowsDetails.newRowsDataUpdates),
  ]);

  useEffect(() => {
    if (showBulkSelector) {
      const selectedRowsOriginalData = selectedFlatRows.map((row) => row.original);
      const selectedRowsId = selectedFlatRows.map((row) => row.id);
      setExposedVariables({ selectedRows: selectedRowsOriginalData, selectedRowsId: selectedRowsId });
      const selectedRowsDetails = selectedFlatRows.reduce((accumulator, row) => {
        accumulator.push({ selectedRowId: row.id, selectedRow: row.original });
        return accumulator;
      }, []);
      mergeToTableDetails({ selectedRowsDetails });
    }
    if (
      allowSelection &&
      ((!showBulkSelector && !highlightSelectedRow) ||
        (showBulkSelector && !highlightSelectedRow && preSelectRow.current))
    ) {
      const selectedRow = selectedFlatRows?.[0]?.original ?? {};
      const selectedRowId = selectedFlatRows?.[0]?.id ?? null;
      setExposedVariables({ selectedRow, selectedRowId });
      mergeToTableDetails({ selectedRow, selectedRowId });
    }
  }, [selectedFlatRows.length, selectedFlatRows]);

  useEffect(() => {
    setExposedVariable('downloadTableData', async function (format) {
      exportData(format, true);
    });
  }, [_.toString(globalFilteredRows), columns]);

  useEffect(() => {
    if (mounted) {
      setExposedVariables({ selectedRows: [], selectedRowsId: [], selectedRow: {}, selectedRowId: null });
      mergeToTableDetails({ selectedRowsDetails: [], selectedRow: {}, selectedRowId: null });
      toggleAllRowsSelected(false);
    }
  }, [showBulkSelector, highlightSelectedRow, allowSelection]);

  React.useEffect(() => {
    if (enablePagination) {
      if (serverSidePagination || !clientSidePagination) {
        setPageSize(rows?.length || 10);
      }
      if (!serverSidePagination && clientSidePagination) {
        setPageSize(rowsPerPage || 10);
      }
    } else {
      setPageSize(rows?.length || 10);
    }
  }, [clientSidePagination, serverSidePagination, rows, rowsPerPage]);

  useEffect(() => {
    if (!initialPageCountRef.current && serverSidePagination && data?.length && totalRecords) {
      initialPageCountRef.current = Math.ceil(totalRecords / data?.length);
    }
    if (!serverSidePagination) {
      initialPageCountRef.current = Math.ceil(data?.length / rowsPerPage);
    }
  }, [serverSidePagination, totalRecords, data?.length, rowsPerPage]);

  useEffect(() => {
    const pageData = page.map((row) => row.original);
    if (preSelectRow.current) {
      preSelectRow.current = false;
    } else {
      onComponentOptionsChanged(component, [
        ['currentPageData', pageData],
        ['currentData', data],
        ['selectedRow', []],
        ['selectedRowId', null],
      ]);
      if (tableDetails.selectedRowId || !_.isEmpty(tableDetails.selectedRowDetails)) {
        toggleAllRowsSelected(false);
        mergeToTableDetails({ selectedRow: {}, selectedRowId: null, selectedRowDetails: [] });
      }
    }
  }, [tableData.length, _.toString(page), pageIndex, _.toString(data)]);

  useEffect(() => {
    const newColumnSizes = { ...columnSizes, ...state.columnResizing.columnWidths };

    const isColumnSizeChanged = !_.isEmpty(diff(columnSizes, newColumnSizes));

    if (isColumnSizeChanged && !state.columnResizing.isResizingColumn && !_.isEmpty(newColumnSizes)) {
      changeCanDrag(true);
      paramUpdated(
        id,
        'columnSizes',
        {
          value: newColumnSizes,
        },
        { componentDefinitionChanged: true }
      );
    } else {
      changeCanDrag(false);
    }
  }, [state.columnResizing.isResizingColumn]);

  const [paginationInternalPageIndex, setPaginationInternalPageIndex] = useState(pageIndex ?? 1);
  const [rowDetails, setRowDetails] = useState();

  useEffect(() => {
    if (pageCount <= pageIndex) gotoPage(pageCount - 1);
  }, [pageCount]);

  const hoverRef = useRef();

  useEffect(() => {
    if (rowDetails?.hoveredRowId !== '' && hoverRef.current !== rowDetails?.hoveredRowId) rowHover();
  }, [rowDetails]);

  useEffect(() => {
    setExposedVariable(
      'filteredData',
      globalFilteredRows.map((row) => row.original)
    );
  }, [JSON.stringify(globalFilteredRows.map((row) => row.original))]);

  const rowHover = () => {
    mergeToTableDetails(rowDetails);
    setExposedVariables(rowDetails);
    fireEvent('onRowHovered');
  };
  useEffect(() => {
    if (_.isEmpty(changeSet)) {
      setExposedVariable(
        'updatedData',
        _.isEmpty(updatedDataReference.current) ? tableData : updatedDataReference.current
      );
    }
  }, [JSON.stringify(changeSet)]);

  useEffect(() => {
    if (
      allowSelection &&
      typeof defaultSelectedRow === 'object' &&
      !_.isEmpty(defaultSelectedRow) &&
      !_.isEmpty(data)
    ) {
      const preSelectedRowDetails = getDetailsOfPreSelectedRow();
      if (_.isEmpty(preSelectedRowDetails)) return;
      const selectedRow = preSelectedRowDetails?.original ?? {};
      const selectedRowIndex = preSelectedRowDetails?.index ?? null;
      const selectedRowId = preSelectedRowDetails?.id ?? null;
      const pageNumber = Math.floor(selectedRowIndex / rowsPerPage) + 1;

      preSelectRow.current = true;
      if (highlightSelectedRow) {
        setExposedVariables({ selectedRow: selectedRow, selectedRowId });
        toggleRowSelected(selectedRowId, true);
        mergeToTableDetails({ selectedRow: selectedRow, selectedRowId });
      } else {
        toggleRowSelected(selectedRowId, true);
      }
      if (pageIndex >= 0 && pageNumber !== pageIndex + 1) {
        gotoPage(pageNumber - 1);
        setPaginationInternalPageIndex(pageNumber);
      }
    }

    //hack : in the initial render, data is undefined since, upon feeding data to the table from some query, query inside current state is {}. Hence we added data in the dependency array, now question is should we add data or rows?
  }, [JSON.stringify(defaultSelectedRow), JSON.stringify(data)]);

  useEffect(() => {
    // csa for select all rows in table
    setExposedVariable('selectAllRows', async function () {
      if (showBulkSelector) {
        await toggleAllRowsSelected(true);
      }
    });
    // csa for deselect all rows in table
    setExposedVariable('deselectAllRows', async function () {
      if (showBulkSelector) {
        await toggleAllRowsSelected(false);
      }
    });
  }, [JSON.stringify(tableDetails.selectedRowsDetails)]);

  const pageData = page.map((row) => row.original);
  useEffect(() => {
    setExposedVariable('currentPageData', pageData);
  }, [JSON.stringify(pageData)]);

  function downlaodPopover() {
    const options = [
      { dataCy: 'option-download-CSV', text: 'Download as CSV', value: 'csv' },
      { dataCy: 'option-download-execel', text: 'Download as Excel', value: 'xlsx' },
      { dataCy: 'option-download-pdf', text: 'Download as PDF', value: 'pdf' },
    ];
    return (
      <Popover
        id="popover-basic"
        data-cy="popover-card"
        className={`${darkMode && 'dark-theme'} shadow table-widget-download-popup`}
        placement="top-end"
      >
        <Popover.Body className="p-0">
          <div className="table-download-option cursor-pointer">
            <span data-cy={`option-download-CSV`} className="cursor-pointer" onClick={() => exportData('csv', true)}>
              Download as CSV
            </span>
            <span
              data-cy={`option-download-execel`}
              className="pt-2 cursor-pointer"
              onClick={() => exportData('xlsx', true)}
            >
              Download as Excel
            </span>
            <span
              data-cy={`option-download-pdf`}
              className="pt-2 cursor-pointer"
              onClick={() => exportData('pdf', true)}
            >
              Download as PDF
            </span>
          </div>
        </Popover.Body>
      </Popover>
    );
  }

  function hideColumnsPopover() {
    const heightOfTableComponent = document.querySelector('.card.jet-table.table-component')?.offsetHeight;
    return (
      <Popover
        className={`${darkMode && 'dark-theme'}`}
        style={{ maxHeight: `${heightOfTableComponent - 79}px`, overflowY: 'auto' }}
      >
        <div
          data-cy={`dropdown-hide-column`}
          className={`dropdown-table-column-hide-common ${
            darkMode ? 'dropdown-table-column-hide-dark-themed dark-theme' : 'dropdown-table-column-hide'
          } `}
          placement="top-end"
        >
          <div className="dropdown-item cursor-pointer">
            <IndeterminateCheckbox {...getToggleHideAllColumnsProps()} />
            <span className="hide-column-name tj-text-xsm" data-cy={`options-select-all-coloumn`}>
              Select All
            </span>
          </div>
          {allColumns.map(
            (column) =>
              typeof column?.Header === 'string' && (
                <div key={column.id}>
                  <div>
                    <label className="dropdown-item d-flex cursor-pointer">
                      <input
                        type="checkbox"
                        data-cy={`checkbox-coloumn-${String(column.Header).toLowerCase().replace(/\s+/g, '-')}`}
                        {...column.getToggleHiddenProps()}
                      />
                      <span
                        className="hide-column-name tj-text-xsm"
                        data-cy={`options-coloumn-${String(column.Header).toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {` ${column.Header}`}
                      </span>
                    </label>
                  </div>
                </div>
              )
          )}
        </div>
      </Popover>
    );
  }
  const calculateWidthOfActionColumnHeader = (position) => {
    let totalWidth = null;
    if (position === 'rightActions') {
      const rightActionBtn = document.querySelector('.has-right-actions');
      totalWidth = rightActionBtn?.offsetWidth;
    }
    if (position === 'leftActions') {
      const leftActionBtn = document.querySelector('.has-left-actions');
      totalWidth = leftActionBtn?.offsetWidth;
    }
    return totalWidth;
  };
  return (
    <div
      data-cy={`draggable-widget-${String(component.name).toLowerCase()}`}
      data-disabled={parsedDisabledState}
      className={`card jet-table table-component ${darkMode ? 'dark-theme' : 'light-theme'}`}
      style={{
        width: `100%`,
        height: `${height}px`,
        display: parsedWidgetVisibility ? '' : 'none',
        overflow: 'hidden',
        borderRadius: Number.parseFloat(borderRadius),
        boxShadow,
        padding: '8px',
        borderColor: borderColor,
      }}
      onClick={(event) => {
        onComponentClick(id, component, event);
      }}
      onMouseEnter={(event) => {
        setTableButtonHoveredId(id);
      }}
      onMouseLeave={(event) => {
        setTableButtonHoveredId("");
      }}
      ref={tableRef}
    >
      {(displaySearchBox || showFilterButton) && (
        <div
          className={`table-card-header d-flex justify-content-between align-items-center ${
            (tableDetails.addNewRowsDetails.addingNewRows || tableDetails.filterDetails.filtersVisible) && 'disabled'
          }`}
          style={{ padding: '12px', height: 56 }}
        >
          <div>
            {loadingState && (
              <SkeletonTheme baseColor="var(--slate3)">
                <Skeleton count={1} width={83} height={28} className="mb-1" />
              </SkeletonTheme>
            )}
            {showFilterButton && !loadingState && (
              <div className="position-relative">
                <Tooltip id="tooltip-for-filter-data" className="tooltip" />
                <ButtonSolid
                  variant="tertiary"
                  className={`tj-text-xsm ${tableDetails.filterDetails.filtersVisible && 'always-active-btn'}`}
                  customStyles={{ minWidth: '32px' }}
                  leftIcon="filter"
                  fill={`var(--icons-default)`}
                  iconWidth="16"
                  onClick={(e) => {
                    if (tableDetails?.filterDetails?.filtersVisible) {
                      hideFilters();
                      if (document.activeElement === e.currentTarget) {
                        e.currentTarget.blur();
                      }
                    } else {
                      showFilters();
                    }
                  }}
                  size="md"
                  data-tooltip-id="tooltip-for-filter-data"
                  data-tooltip-content="Filter data"
                ></ButtonSolid>
                {(tableDetails?.filterDetails?.filtersVisible || !_.isEmpty(tableDetails.filterDetails.filters)) && (
                  <div className="filter-applied-state position-absolute">
                    <svg
                      className="filter-applied-svg"
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 17 17"
                      fill="none"
                    >
                      <circle
                        cx="8.3606"
                        cy="8.08325"
                        r="6.08325"
                        stroke="var(--slate1)"
                        fill="var(--indigo9)"
                        stroke-width="4"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="d-flex custom-gap-8" style={{ maxHeight: 32 }}>
            {loadingState && (
              <SkeletonTheme baseColor="var(--slate3)">
                <Skeleton count={1} width={100} height={28} className="mb-1" />
              </SkeletonTheme>
            )}
            {displaySearchBox && !loadingState && (
              <GlobalFilter
                globalFilter={state.globalFilter}
                setGlobalFilter={setGlobalFilter}
                onComponentOptionChanged={onComponentOptionChanged}
                component={component}
                darkMode={darkMode}
                setExposedVariable={setExposedVariable}
                fireEvent={fireEvent}
              />
            )}
          </div>
        </div>
      )}
      <div
        className={`table-responsive jet-data-table ${(loadingState || page.length === 0) && 'overflow-hidden'} ${
          page.length === 0 && 'position-relative'
        }`}
      >
        <table
          {...getTableProps()}
          className={`table table-vcenter table-nowrap ${tableType} ${darkMode && 'table-dark'} ${
            tableDetails.addNewRowsDetails.addingNewRows && 'disabled'
          } ${!loadingState && page.length !== 0 && 'h-100'} ${
            state?.columnResizing?.isResizingColumn ? 'table-resizing' : ''
          }`}
          style={computedStyles}
        >
          <thead>
            {headerGroups.map((headerGroup, index) => (
              <DragDropContext
                key={index}
                onDragStart={() => {
                  currentColOrder.current = allColumns?.map((o) => o.id);
                }}
                onDragEnd={(dragUpdateObj) => {
                  const colOrder = [...currentColOrder.current];
                  const sIndex = dragUpdateObj.source.index;
                  const dIndex = dragUpdateObj.destination && dragUpdateObj.destination.index;

                  if (typeof sIndex === 'number' && typeof dIndex === 'number') {
                    colOrder.splice(sIndex, 1);
                    colOrder.splice(dIndex, 0, dragUpdateObj.draggableId);
                    setColumnOrder(colOrder);
                  }
                }}
              >
                <Droppable droppableId="droppable" direction="horizontal">
                  {(droppableProvided, snapshot) => (
                    <tr
                      ref={droppableProvided.innerRef}
                      key={index}
                      {...headerGroup.getHeaderGroupProps()}
                      className="tr"
                    >
                      {loadingState && (
                        <div className="w-100">
                          <SkeletonTheme baseColor="var(--slate3)" width="100%">
                            <Skeleton count={1} width={'100%'} height={28} className="mb-1" />
                          </SkeletonTheme>
                        </div>
                      )}
                      {!loadingState &&
                        headerGroup.headers.map((column, index) => {
                          return (
                            <Draggable
                              key={column.id}
                              draggableId={column.id}
                              index={index}
                              isDragDisabled={!column.accessor}
                            >
                              {(provided, snapshot) => {
                                let headerProps = { ...column.getHeaderProps() };
                                if (column.columnType === 'selector') {
                                  headerProps = {
                                    ...headerProps,
                                    style: {
                                      ...headerProps.style,
                                      width: 40,
                                      padding: 0,
                                      display: 'flex',
                                      'align-items': 'center',
                                      'justify-content': 'center',
                                    },
                                  };
                                }
                                if (column.Header === 'Actions') {
                                  headerProps = {
                                    ...headerProps,
                                    style: {
                                      ...headerProps.style,
                                      width: calculateWidthOfActionColumnHeader(column.id),
                                      maxWidth: calculateWidthOfActionColumnHeader(column.id),
                                      padding: 0,
                                      display: 'flex',
                                      'align-items': 'center',
                                      'justify-content': 'center',
                                    },
                                  };
                                }
                                if (
                                  headerGroup?.headers?.[headerGroup?.headers?.length - 1]?.Header === 'Actions' &&
                                  index === headerGroup?.headers?.length - 2
                                ) {
                                  headerProps = {
                                    ...headerProps,
                                    style: {
                                      ...headerProps.style,
                                      flex: '1 1 auto',
                                    },
                                  };
                                }
                                const isEditable = resolveReferences(column?.isEditable ?? false);
                                return (
                                  <th
                                    key={index}
                                    {...headerProps}
                                    className={`th tj-text-xsm font-weight-400 ${
                                      column.isSorted && (column.isSortedDesc ? '' : '')
                                    } ${column.isResizing && 'resizing-column'} ${
                                      column.Header === 'Actions' && 'has-actions'
                                    } position-relative ${column.columnType === 'selector' && 'selector-header'}`}
                                  >
                                    <div
                                      className={`${
                                        column.columnType !== 'selector' &&
                                        'd-flex justify-content-between custom-gap-12'
                                      } ${column.columnType === 'selector' && 'd-flex justify-content-center w-100'}`}
                                      {...column.getSortByToggleProps()}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      // {...extraProps}
                                      ref={provided.innerRef}
                                      style={{
                                        ...getItemStyle(snapshot, provided.draggableProps.style),
                                      }}
                                    >
                                      <div
                                        className={`d-flex thead-editable-icon-header-text-wrapper
                                          ${
                                            column.columnType === 'selector'
                                              ? 'justify-content-center'
                                              : `justify-content-${determineJustifyContentValue(
                                                  column?.horizontalAlignment ?? ''
                                                )}`
                                          }
                                          ${column.columnType !== 'selector' && isEditable && 'custom-gap-4'}
                                          `}
                                      >
                                        <div>
                                          {column.columnType !== 'selector' &&
                                            column.columnType !== 'image' &&
                                            isEditable && (
                                              <SolidIcon
                                                name="editable"
                                                width="16px"
                                                height="16px"
                                                fill={darkMode ? '#4C5155' : '#C1C8CD'}
                                                vievBox="0 0 16 16"
                                              />
                                            )}
                                        </div>
                                        <div
                                          data-cy={`column-header-${String(column.exportValue)
                                            .toLowerCase()
                                            .replace(/\s+/g, '-')}`}
                                          className={cx('header-text', {
                                            'selector-column':
                                              column.id === 'selection' && column.columnType === 'selector',
                                            'text-truncate':
                                              resolveReferences(columnHeaderWrap, currentState) === 'fixed',
                                            'wrap-wrapper':
                                              resolveReferences(columnHeaderWrap, currentState) === 'wrap',
                                          })}
                                        >
                                          {column.render('Header')}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display:
                                            column?.columnType !== 'selector' && column?.isSorted ? 'block' : 'none',
                                        }}
                                      >
                                        {column?.isSortedDesc ? (
                                          <SolidIcon
                                            name="arrowdown"
                                            width="16"
                                            height="16"
                                            fill={darkMode ? '#ECEDEE' : '#11181C'}
                                          />
                                        ) : (
                                          <SolidIcon
                                            name="arrowup"
                                            width="16"
                                            height="16"
                                            fill={darkMode ? '#ECEDEE' : '#11181C'}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onMouseMove={(e) => {
                                        if (column.id !== resizingColumnId) {
                                          setResizingColumnId(column.id);
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (resizingColumnId) {
                                          setResizingColumnId(null);
                                        }
                                      }}
                                      draggable="true"
                                      {...column.getResizerProps()}
                                      className={`${
                                        (column.id === 'selection' && column.columnType === 'selector') ||
                                        column.Header === 'Actions'
                                          ? ''
                                          : 'resizer'
                                      }  ${column.isResizing ? 'isResizing' : ''}`}
                                    >
                                      <div
                                        className="table-column-resize-handle"
                                        style={{
                                          ...(column.isResizing && { display: 'block' }),
                                        }}
                                      ></div>
                                    </div>
                                  </th>
                                );
                              }}
                            </Draggable>
                          );
                        })}
                    </tr>
                  )}
                </Droppable>
              </DragDropContext>
            ))}
          </thead>

          {!loadingState && (
            <tbody {...getTableBodyProps()} style={{ color: computeFontColor() }}>
              {page.map((row, index) => {
                prepareRow(row);
                let rowProps = { ...row.getRowProps() };
                const contentWrap = resolveReferences(contentWrapProperty);
                const isMaxRowHeightAuto = maxRowHeight === 'auto';
                rowProps.style.minHeight = cellSize === 'condensed' ? '39px' : '45px'; // 1px is removed to accomodate 1px border-bottom
                let cellMaxHeight;
                let cellHeight;
                if (contentWrap) {
                  cellMaxHeight = isMaxRowHeightAuto ? 'fit-content' : resolveReferences(maxRowHeightValue) + 'px';
                  rowProps.style.maxHeight = cellMaxHeight;
                } else {
                  cellMaxHeight = cellSize === 'condensed' ? 40 : 46;
                  cellHeight = cellSize === 'condensed' ? 40 : 46;
                  rowProps.style.maxHeight = cellMaxHeight + 'px';
                  rowProps.style.height = cellHeight + 'px';
                }
                const showInvalidError = row.cells.some((cell) => isRowInValid(cell, currentState, changeSet));
                if (showInvalidError) {
                  rowProps.style.maxHeight = 'fit-content';
                  rowProps.style.height = '';
                }
                return (
                  <tr
                    key={index}
                    className={`table-row table-editor-component-row ${
                      allowSelection &&
                      highlightSelectedRow &&
                      ((row.isSelected && row.id === tableDetails.selectedRowId) ||
                        (showBulkSelector &&
                          row.isSelected &&
                          tableDetails?.selectedRowsDetails?.some((singleRow) => singleRow.selectedRowId === row.id)))
                        ? 'selected'
                        : ''
                    }`}
                    {...rowProps}
                    onClick={async (e) => {
                      e.stopPropagation();
                      // toggleRowSelected will triggered useRededcuer function in useTable and in result will get the selectedFlatRows consisting row which are selected
                      if (allowSelection) {
                        await toggleRowSelected(row.id);
                      }
                      const selectedRow = row.original;
                      const selectedRowId = row.id;
                      setExposedVariables({ selectedRow, selectedRowId });
                      mergeToTableDetails({ selectedRow, selectedRowId });
                      fireEvent('onRowClicked');
                    }}
                    onMouseOver={(e) => {
                      if (hoverAdded) {
                        const hoveredRowDetails = { hoveredRowId: row.id, hoveredRow: row.original };
                        setRowDetails(hoveredRowDetails);
                        hoverRef.current = rowDetails?.hoveredRowId;
                      }
                    }}
                    onMouseLeave={(e) => {
                      hoverAdded && setRowDetails({ hoveredRowId: '', hoveredRow: '' });
                    }}
                  >
                    {row.cells.map((cell, index) => {
                      let cellProps = cell.getCellProps();
                      cellProps.style.textAlign = cell.column?.horizontalAlignment;
                      if (tableDetails.changeSet) {
                        if (tableDetails.changeSet[cell.row.index]) {
                          const currentColumn = columnData.find((column) => column.id === cell.column.id);
                          if (
                            _.get(tableDetails.changeSet[cell.row.index], currentColumn?.accessor, undefined) !==
                            undefined
                          ) {
                            cellProps.style.backgroundColor = 'var(--orange3)';
                            cellProps.style['--tblr-table-accent-bg'] = 'var(--orange3)';
                          }
                        }
                      }
                      if (cell.column.columnType === 'selector') {
                        cellProps.style.width = 40;
                        cellProps.style.padding = 0;
                      }
                      if (cell.column.Header === 'Actions') {
                        cellProps.style.width = 'fit-content';
                        cellProps.style.maxWidth = 'fit-content';
                      }
                      if (
                        row.cells?.[row.cells?.length - 1]?.column.Header === 'Actions' &&
                        index === row?.cells?.length - 2
                      ) {
                        cellProps.style.flex = '1 1 auto';
                      }
                      //should we remove this
                      const wrapAction = textWrapActions(cell.column.id);
                      const rowChangeSet = changeSet ? changeSet[cell.row.index] : null;
                      const cellValue = rowChangeSet ? rowChangeSet[cell.column.name] || cell.value : cell.value;
                      const rowData = tableData[cell.row.index];
                      const cellBackgroundColor = ![
                        'dropdown',
                        'badge',
                        'badges',
                        'tags',
                        'radio',
                        'link',
                        'multiselect',
                        'toggle',
                      ].includes(cell?.column?.columnType)
                        ? resolveReferences(cell.column?.cellBackgroundColor, '', {
                            cellValue,
                            rowData,
                          })
                        : '';
                      const cellTextColor = resolveReferences(cell.column?.textColor, '', {
                        cellValue,
                        rowData,
                      });
                      const actionButtonsArray = actions.map((action) => {
                        return {
                          ...action,
                          isDisabled: resolveReferences(action?.disableActionButton ?? false, '', {
                            cellValue,
                            rowData,
                          }),
                        };
                      });
                      const isEditable = resolveReferences(cell.column?.isEditable ?? false, '', {
                        cellValue,
                        rowData,
                      });
                      const horizontalAlignment = cell.column?.horizontalAlignment;
                      return (
                        // Does not require key as its already being passed by react-table via cellProps
                        // eslint-disable-next-line react/jsx-key
                        <td
                          data-cy={`${cell.column.columnType ?? ''}${String(
                            cell.column.id === 'rightActions' || cell.column.id === 'leftActions' ? cell.column.id : ''
                          )}${String(cellValue ?? '').toLocaleLowerCase()}-cell-${index}`}
                          className={cx(
                            `table-text-align-${cell.column.horizontalAlignment}  
                            ${cell?.column?.Header !== 'Actions' && (contentWrap ? 'wrap-wrapper' : '')}
                            td`,
                            {
                              'has-actions': cell.column.id === 'rightActions' || cell.column.id === 'leftActions',
                              'has-left-actions': cell.column.id === 'leftActions',
                              'has-right-actions': cell.column.id === 'rightActions',
                              'has-text': cell.column.columnType === 'text' || isEditable,
                              'has-number': cell.column.columnType === 'number',
                              'has-dropdown': cell.column.columnType === 'dropdown',
                              'has-multiselect': cell.column.columnType === 'multiselect',
                              'has-datepicker': cell.column.columnType === 'datepicker',
                              'align-items-center flex-column': cell.column.columnType === 'selector',
                              'has-badge': ['badge', 'badges'].includes(cell.column.columnType),
                              [cellSize]: true,
                              'overflow-hidden':
                                ['text', 'string', undefined, 'number'].includes(cell.column.columnType) &&
                                !contentWrap,
                              'selector-column':
                                cell.column.columnType === 'selector' && cell.column.id === 'selection',
                              'resizing-column': cell.column.isResizing || cell.column.id === resizingColumnId,
                              'has-select': ['select', 'newMultiSelect'].includes(cell.column.columnType),
                              'has-tags': cell.column.columnType === 'tags',
                              'has-link': cell.column.columnType === 'link',
                              'has-radio': cell.column.columnType === 'radio',
                              'has-toggle': cell.column.columnType === 'toggle',
                              'has-textarea': ['string', 'text'].includes(cell.column.columnType),
                              isEditable: isEditable,
                            }
                          )}
                          {...cellProps}
                          style={{ ...cellProps.style, backgroundColor: cellBackgroundColor ?? 'inherit' }}
                          onClick={(e) => {
                            if (
                              (isEditable || ['rightActions', 'leftActions'].includes(cell.column.id)) &&
                              allowSelection &&
                              !selectRowOnCellEdit
                            ) {
                              // to avoid on click event getting propagating to row when td is editable or has action button and allowSelection is true and selectRowOnCellEdit is false
                              e.stopPropagation();
                            }
                            setExposedVariable('selectedCell', {
                              columnName: cell.column.exportValue,
                              columnKey: cell.column.key,
                              value: cellValue,
                            });
                          }}
                        >
                          <div
                            className={`td-container ${
                              cell.column.columnType === 'image' && 'jet-table-image-column h-100'
                            } ${cell.column.columnType !== 'image' && `w-100 h-100`}`}
                          >
                            <GenerateEachCellValue
                              cellValue={cellValue}
                              globalFilter={state.globalFilter}
                              cellRender={cell.render('Cell', {
                                cell,
                                actionButtonsArray,
                                isEditable,
                                horizontalAlignment,
                                cellTextColor,
                                contentWrap,
                                autoHeight,
                                isMaxRowHeightAuto,
                              })}
                              rowChangeSet={rowChangeSet}
                              isEditable={isEditable}
                              columnType={cell.column.columnType}
                              isColumnTypeAction={['rightActions', 'leftActions'].includes(cell.column.id)}
                              cellTextColor={cellTextColor}
                              cell={cell}
                              currentState={currentState}
                              cellWidth={cell.column.width}
                              isCellValueChanged={isCellValueChanged}
                              setIsCellValueChanged={setIsCellValueChanged}
                              darkMode={darkMode}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
        {!loadingState && page.length === 0 && (
          <div
            className="d-flex flex-column align-items-center custom-gap-8 justify-content-center h-100"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translateY(-50%) translateX(-50%)',
            }}
          >
            <div className="warning-no-data">
              <div className="warning-svg-wrapper">
                <SolidIcon name="warning" width="16" />
              </div>
            </div>
            <div className="warning-no-data-text">No data</div>
          </div>
        )}
        {loadingState === true && (
          <div style={{ width: '100%' }} className="p-2 h-100 ">
            <div className="d-flex align-items-center justify-content-center h-100">
              <svg
                className="loading-spinner-table-component"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="var(--indigo6)"
              >
                <style>.spinner_ajPY{}</style>
                <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25" />
                <path
                  d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                  class="spinner_ajPY"
                  fill="var(--indigo9)"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
      {(enablePagination ||
        Object.keys(tableDetails.changeSet || {}).length > 0 ||
        showAddNewRowButton ||
        showDownloadButton) && (
        <div
          className={`card-footer d-flex align-items-center jet-table-footer justify-content-center ${
            darkMode && 'dark-theme'
          } ${
            (tableDetails.addNewRowsDetails.addingNewRows || tableDetails.filterDetails.filtersVisible) && 'disabled'
          }`}
        >
          <div className={`table-footer row gx-0 d-flex align-items-center h-100`}>
            <div className="col d-flex justify-content-start custom-gap-4">
              {loadingState && (
                <SkeletonTheme baseColor="var(--slate3)" width="100%">
                  <Skeleton count={1} width={83} height={28} className="mb-1" />
                </SkeletonTheme>
              )}
              {!loadingState &&
                (showBulkUpdateActions && Object.keys(tableDetails.changeSet || {}).length > 0 ? (
                  <>
                    <ButtonSolid
                      variant="primary"
                      className={`tj-text-xsm`}
                      onClick={() => {
                        setIsCellValueChanged(false);
                        onEvent('onBulkUpdate', tableEvents, { component }).then(() => {
                          handleChangesSaved();
                        });
                      }}
                      data-cy={`table-button-save-changes`}
                      size="md"
                      isLoading={tableDetails.isSavingChanges ? true : false}
                      customStyles={{ minWidth: '32px', padding: width > 650 ? '6px 16px' : 0 }}
                      leftIcon={width > 650 ? '' : 'save'}
                      fill="#FDFDFE"
                      iconWidth="16"
                    >
                      {width > 650 ? <span>Save changes</span> : ''}
                    </ButtonSolid>
                    <ButtonSolid
                      variant="tertiary"
                      className={`tj-text-xsm`}
                      onClick={() => {
                        setIsCellValueChanged(false);
                        handleChangesDiscarded();
                      }}
                      data-cy={`table-button-discard-changes`}
                      size="md"
                      customStyles={{ minWidth: '32px', padding: width > 650 ? '6px 16px' : 0 }}
                      leftIcon={width > 650 ? '' : 'cross'}
                      fill={'var(--slate11)'}
                      iconWidth="16"
                    >
                      {width > 650 ? <span>Discard</span> : ''}
                    </ButtonSolid>
                  </>
                ) : (
                  !loadingState && (
                    <span
                      data-cy={`footer-number-of-records`}
                      className="font-weight-500"
                      style={{ color: 'var(--text-placeholder)' }}
                    >
                      {clientSidePagination && !serverSidePagination && `${globalFilteredRows.length} Records`}
                      {serverSidePagination && totalRecords ? `${totalRecords} Records` : ''}
                    </span>
                  )
                ))}
            </div>
            <div className={`col d-flex justify-content-center h-100 ${loadingState && 'w-100'}`}>
              {enablePagination && (
                <Pagination
                  lastActivePageIndex={pageIndex}
                  serverSide={serverSidePagination}
                  autoGotoPage={gotoPage}
                  autoCanNextPage={canNextPage}
                  autoPageCount={initialPageCountRef.current}
                  autoPageOptions={pageOptions}
                  onPageIndexChanged={onPageIndexChanged}
                  pageIndex={paginationInternalPageIndex}
                  setPageIndex={setPaginationInternalPageIndex}
                  enableNextButton={enableNextButton}
                  enablePrevButton={enablePrevButton}
                  darkMode={darkMode}
                  tableWidth={width}
                  loadingState={loadingState}
                />
              )}
            </div>
            <div className="col d-flex justify-content-end ">
              {loadingState && (
                <SkeletonTheme baseColor="var(--slate3)" width="100%">
                  <Skeleton count={1} width={83} height={28} className="mb-1" />
                </SkeletonTheme>
              )}
              {!loadingState && showAddNewRowButton && (
                <>
                  <Tooltip id={ `tooltip-for-add-new-row-${id}` } className="tooltip" />
                  <ButtonSolid
                    variant="ghostBlack"
                    fill={`var(--icons-default)`}
                    className={`tj-text-xsm ${
                      tableDetails.addNewRowsDetails.addingNewRows && 'cursor-not-allowed always-active-btn'
                    }`}
                    customStyles={{ minWidth: '32px' }}
                    leftIcon="plus"
                    iconWidth="16"
                    onClick={() => {
                      if (!tableDetails.addNewRowsDetails.addingNewRows) {
                        showAddNewRowPopup();
                      }
                    }}
                    size="md"
                    data-tooltip-id={ tableButtonHoveredId === id ? `tooltip-for-add-new-row-${id}` : "" }
                    data-tooltip-content="Add new row"
                  ></ButtonSolid>
                </>
              )}
              {!loadingState && showDownloadButton && (
                <div>
                  <Tooltip id={`tooltip-for-download-${id}`} className="tooltip" />
                  <OverlayTriggerComponent
                    trigger="click"
                    overlay={downlaodPopover()}
                    rootClose={true}
                    placement={'top-end'}
                  >
                    <ButtonSolid
                      variant="ghostBlack"
                      className={`tj-text-xsm `}
                      customStyles={{
                        minWidth: '32px',
                      }}
                      leftIcon="filedownload"
                      fill={`var(--icons-default)`}
                      iconWidth="16"
                      size="md"
                      data-tooltip-id={ tableButtonHoveredId === id ? `tooltip-for-download-${id}` : "" }
                      data-tooltip-content="Download"
                      onClick={(e) => {
                        if (document.activeElement === e.currentTarget) {
                          e.currentTarget.blur();
                        }
                      }}
                    ></ButtonSolid>
                  </OverlayTriggerComponent>
                </div>
              )}
              {!loadingState && !hideColumnSelectorButton && (
                <>
                  <Tooltip id={`tooltip-for-manage-columns-${id}`} className="tooltip" />
                  <OverlayTriggerComponent
                    trigger="click"
                    rootClose={true}
                    overlay={hideColumnsPopover()}
                    placement={'top-end'}
                  >
                    <ButtonSolid
                      variant="ghostBlack"
                      className={`tj-text-xsm `}
                      customStyles={{ minWidth: '32px' }}
                      leftIcon="eye1"
                      fill={`var(--icons-default)`}
                      iconWidth="16"
                      size="md"
                      data-cy={`select-column-icon`}
                      onClick={(e) => {
                        if (document.activeElement === e.currentTarget) {
                          e.currentTarget.blur();
                        }
                      }}
                      data-tooltip-id={ tableButtonHoveredId === id ? `tooltip-for-manage-columns-${id}` : "" }
                      data-tooltip-content="Manage columns"
                    ></ButtonSolid>
                  </OverlayTriggerComponent>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <Filter
        hideFilters={hideFilters}
        filters={tableDetails.filterDetails.filters}
        columns={columnData.map((column) => {
          return { name: column.Header, value: column.id };
        })}
        mergeToFilterDetails={mergeToFilterDetails}
        filterDetails={tableDetails.filterDetails}
        darkMode={darkMode}
        setAllFilters={setAllFilters}
        fireEvent={fireEvent}
        setExposedVariable={setExposedVariable}
      />
      {tableDetails.addNewRowsDetails.addingNewRows && (
        <AddNewRowComponent
          hideAddNewRowPopup={hideAddNewRowPopup}
          tableType={tableType}
          darkMode={darkMode}
          mergeToAddNewRowsDetails={mergeToAddNewRowsDetails}
          onEvent={onEvent}
          component={component}
          setExposedVariable={setExposedVariable}
          allColumns={allColumns}
          defaultColumn={defaultColumn}
          columns={columnsForAddNewRow}
          addNewRowsDetails={tableDetails.addNewRowsDetails}
          utilityForNestedNewRow={utilityForNestedNewRow}
          tableEvents={tableEvents}
        />
      )}
    </div>
  );
}
