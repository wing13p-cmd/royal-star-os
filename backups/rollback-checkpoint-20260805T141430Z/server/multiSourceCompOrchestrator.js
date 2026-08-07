function buildMultiSourceCompSearchService({ adapters = {} } = {}) {
  const executeProviderRequest = async (name, adapter, query, operation) => {
    const status = adapter.getProviderStatus();
    if (!status.configured || status.status === "Disabled") {
      return { provider: name, status: status.status, records: [], media: [], unavailable: true };
    }
    try {
      const result = await adapter[operation](query);
      return { provider: name, status: "Success", records: Array.isArray(result) ? result : [], media: [], unavailable: false };
    } catch (error) {
      return { provider: name, status: "Failed", records: [], media: [], unavailable: true };
    }
  };

  return {
    async searchSoldComparables(query = {}) {
      const providerEntries = Object.entries(adapters);
      const providersQueried = providerEntries.map(([name]) => name);
      const providersSuccessful = [];
      const providersFailed = [];
      const providersUnavailable = [];
      const records = [];
      const providerResults = [];

      for (const [name, adapter] of providerEntries) {
        const result = await executeProviderRequest(name, adapter, query, "searchSoldComparables");
        providerResults.push(result);
        if (result.unavailable && result.status !== "Success") {
          providersUnavailable.push(name);
          continue;
        }
        if (result.status === "Success") {
          records.push(...result.records);
          providersSuccessful.push(name);
          continue;
        }
        providersFailed.push(name);
      }

      return {
        providersQueried,
        providersSuccessful,
        providersFailed,
        providersUnavailable,
        records,
        providerResults,
        duplicatesMerged: 0,
        sourceConflicts: [],
        mediaAvailable: 0,
        mediaUnavailable: 0,
        mediaRestricted: 0,
        requestDurationMs: 0,
        cachedResults: false,
      };
    },

    async searchActiveListings(query = {}) {
      const providerEntries = Object.entries(adapters);
      const providersQueried = providerEntries.map(([name]) => name);
      const providersSuccessful = [];
      const providersFailed = [];
      const providersUnavailable = [];
      const records = [];
      const providerResults = [];

      for (const [name, adapter] of providerEntries) {
        const result = await executeProviderRequest(name, adapter, query, "searchActiveListings");
        providerResults.push(result);
        if (result.unavailable && result.status !== "Success") {
          providersUnavailable.push(name);
          continue;
        }
        if (result.status === "Success") {
          records.push(...result.records);
          providersSuccessful.push(name);
          continue;
        }
        providersFailed.push(name);
      }

      return {
        providersQueried,
        providersSuccessful,
        providersFailed,
        providersUnavailable,
        records,
        providerResults,
        duplicatesMerged: 0,
        sourceConflicts: [],
        mediaAvailable: 0,
        mediaUnavailable: 0,
        mediaRestricted: 0,
        requestDurationMs: 0,
        cachedResults: false,
      };
    },
  };
}

export { buildMultiSourceCompSearchService };
export default buildMultiSourceCompSearchService;
