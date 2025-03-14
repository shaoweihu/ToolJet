import React, { createContext, useMemo, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/_ui/Layout';
import { globalDatasourceService, appEnvironmentService, authenticationService } from '@/_services';
import { GlobalDataSourcesPage } from './GlobalDataSourcesPage';
import { toast } from 'react-hot-toast';
import { BreadCrumbContext } from '@/App/App';
import { DATA_SOURCE_TYPE } from '@/_helpers/constants';
import { fetchAndSetWindowTitle, pageTitles } from '@white-label/whiteLabelling';

export const GlobalDataSourcesContext = createContext({
  showDataSourceManagerModal: false,
  toggleDataSourceManagerModal: () => {},
  selectedDataSource: null,
  setSelectedDataSource: () => {},
});

export const GlobalDatasources = (props) => {
  const { admin } = authenticationService.currentSessionValue;
  const [selectedDataSource, setSelectedDataSource] = useState(null);
  const [dataSources, setDataSources] = useState([]);
  const [showDataSourceManagerModal, toggleDataSourceManagerModal] = useState(false);
  const [isEditing, setEditing] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [environments, setEnvironments] = useState([]);
  const [currentEnvironment, setCurrentEnvironment] = useState(null);
  const [activeDatasourceList, setActiveDatasourceList] = useState('#commonlyused');
  const navigate = useNavigate();
  const { updateSidebarNAV } = useContext(BreadCrumbContext);

  if (!admin) {
    navigate('/');
  }

  useEffect(() => {
    if (dataSources?.length == 0) updateSidebarNAV('Commonly used');
  }, []);

  useEffect(() => {
    selectedDataSource
      ? updateSidebarNAV(selectedDataSource.name)
      : !activeDatasourceList && updateSidebarNAV('Commonly used');
    fetchAndSetWindowTitle({ page: `${selectedDataSource?.name || pageTitles.DATA_SOURCES}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dataSources), JSON.stringify(selectedDataSource)]);

  useEffect(() => {
    if (!admin) {
      toast.error("You don't have access to GDS, contact your workspace admin to add datasources");
    } else {
      fetchEnvironments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  function updateSelectedDatasource(source) {
    updateSidebarNAV(source);
  }

  const fetchDataSources = async (resetSelection = false, dataSource = null) => {
    toggleDataSourceManagerModal(false);
    setLoading(true);
    globalDatasourceService
      .getAll()
      .then((data) => {
        const orderedDataSources = data.data_sources
          .map((ds) => {
            if (ds.options && ds.options.connection_limit) {
              return {
                ...ds,
                options: {
                  ...ds.options,
                  connectionLimit: ds.options.connection_limit,
                },
              };
            }
            return ds;
          })
          .sort((a, b) => {
            if (a.type === DATA_SOURCE_TYPE.SAMPLE && b.type !== DATA_SOURCE_TYPE.SAMPLE) {
              return -1; // a comes before b
            } else if (a.type !== DATA_SOURCE_TYPE.SAMPLE && b.type === DATA_SOURCE_TYPE.SAMPLE) {
              return 1; // b comes before a
            } else {
              // If types are the same or both are not 'sample', sort by name
              return a.name.localeCompare(b.name);
            }
          });
        setDataSources([...(orderedDataSources ?? [])]);
        const ds = dataSource && orderedDataSources.find((ds) => ds.id === dataSource.id);
        if (!resetSelection && ds) {
          setEditing(true);
          setSelectedDataSource(ds);
          toggleDataSourceManagerModal(true);
        }
        if (orderedDataSources.length && resetSelection) {
          setActiveDatasourceList('#commonlyused');
        }
        if (!orderedDataSources.length) {
          setActiveDatasourceList('#commonlyused');
        }
        setLoading(false);
      })
      .catch(() => {
        setDataSources([]);
        setLoading(false);
      });
  };

  const handleToggleSourceManagerModal = () => {
    toggleDataSourceManagerModal(
      (prevState) => !prevState,
      () => setEditing((prev) => !prev)
    );
  };

  const handleModalVisibility = () => {
    if (selectedDataSource) {
      return setSelectedDataSource(null, () => handleToggleSourceManagerModal());
    }

    handleToggleSourceManagerModal();
  };

  const fetchEnvironments = () => {
    appEnvironmentService.getAllEnvironments().then((data) => {
      const envArray = data?.environments;
      setEnvironments(envArray);
      if (envArray.length > 0) {
        const env = envArray.find((env) => env.is_default === true);
        setCurrentEnvironment(env);
      }
    });
  };

  const value = useMemo(
    () => ({
      selectedDataSource,
      setSelectedDataSource,
      fetchDataSources,
      dataSources,
      showDataSourceManagerModal,
      toggleDataSourceManagerModal,
      handleModalVisibility,
      isEditing,
      setEditing,
      fetchEnvironments,
      environments,
      currentEnvironment,
      setCurrentEnvironment,
      setDataSources,
      isLoading,
      activeDatasourceList,
      setActiveDatasourceList,
      setLoading,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedDataSource,
      dataSources,
      showDataSourceManagerModal,
      isEditing,
      environments,
      currentEnvironment,
      isLoading,
      activeDatasourceList,
    ]
  );

  return (
    <Layout switchDarkMode={props.switchDarkMode} darkMode={props.darkMode}>
      <GlobalDataSourcesContext.Provider value={value}>
        <div className="page-wrapper">
          <GlobalDataSourcesPage darkMode={props.darkMode} updateSelectedDatasource={updateSelectedDatasource} />
        </div>
      </GlobalDataSourcesContext.Provider>
    </Layout>
  );
};
