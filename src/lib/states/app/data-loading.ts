import { atom, type Getter, type Setter } from "jotai/vanilla";
import {
  extractDataSources,
  normalizeDataSource,
  validateDataSource,
  type DataSourceSpec,
} from "../../core/data-source.js";
import { dictionariesAtom } from "./dictionary.js";
import { settingsDataAtom } from "./settings.js";
import { addToast, formatErrorMessage } from "./toast.js";

export interface DataAPI {
  fetchData: (source: DataSourceSpec) => Promise<string>;
}

export const dataAPIAtom = atom<DataAPI>();

const isDataLoadingBaseAtom = atom(false);

export const isDataLoadingAtom = atom((get) => get(isDataLoadingBaseAtom));

export async function loadDictionaryData(
  get: Getter,
  set: Setter,
): Promise<void> {
  const dataAPI = get(dataAPIAtom);
  if (!dataAPI) {
    addToast(set, {
      severity: "error",
      message: "toast.dataApiNotAvailable",
    });
    return;
  }

  const isLoading = get(isDataLoadingBaseAtom);
  if (isLoading) {
    addToast(set, {
      severity: "warning",
      message: "toast.dataLoadingInProgress",
    });
    return;
  }

  const settingsData = get(settingsDataAtom);
  const dataSources = extractDataSources(settingsData.dictionarySources);

  if (dataSources.length === 0) {
    addToast(set, {
      severity: "warning",
      message: "toast.noDictionarySourcesConfigured",
    });
    return;
  }

  // Validate and normalize sources
  const validSources: DataSourceSpec[] = [];
  const invalidSources: string[] = [];

  for (const source of dataSources) {
    const normalized = normalizeDataSource(source);
    if (validateDataSource(normalized)) {
      validSources.push(normalized);
    } else {
      invalidSources.push(source.source);
    }
  }

  if (invalidSources.length > 0) {
    addToast(set, {
      severity: "warning",
      message: "toast.invalidDataSourcesFound",
      params: { sources: invalidSources.join(", ") },
    });
  }

  if (validSources.length === 0) {
    addToast(set, {
      severity: "error",
      message: "toast.noValidDictionarySourcesFound",
    });
    return;
  }

  set(isDataLoadingBaseAtom, true);

  addToast(set, {
    severity: "info",
    message: "toast.loadingDictionaryData",
    params: { count: validSources.length },
  });

  try {
    const loadedData: string[] = [];
    const errors: string[] = [];

    for (const source of validSources) {
      try {
        const data = await dataAPI.fetchData(source);
        loadedData.push(data);

        addToast(set, {
          severity: "info",
          message: "toast.dataLoadedSuccessfully",
          params: { source: source.source },
        });
      } catch (error) {
        const errorMessage = formatErrorMessage(error);
        errors.push(`${source.source}: ${errorMessage}`);

        addToast(set, {
          severity: "error",
          message: "toast.dataLoadingFailed",
          params: { source: source.source, error: errorMessage },
        });
      }
    }

    if (loadedData.length > 0) {
      set(dictionariesAtom, loadedData);

      addToast(set, {
        severity: "info",
        message: "toast.dictionaryDataLoadedSuccessfully",
        params: { loaded: loadedData.length, total: validSources.length },
      });
    } else {
      addToast(set, {
        severity: "error",
        message: "toast.failedToLoadAnyDictionaryData",
      });
    }

    if (errors.length > 0) {
      console.error("Dictionary loading errors:", errors);
    }
  } catch (error) {
    const errorMessage = formatErrorMessage(error);
    addToast(set, {
      severity: "error",
      message: "toast.dictionaryLoadingFailed",
      params: { error: errorMessage },
    });
  } finally {
    set(isDataLoadingBaseAtom, false);
  }
}
