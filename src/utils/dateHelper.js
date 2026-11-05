const getDateFilter = (fromDate, toDate) => {
  if (!fromDate || !toDate) {
    return {};
  }

  const start = new Date(`${fromDate}T00:00:00+05:30`);

  const end = new Date(
    new Date(`${toDate}T00:00:00+05:30`).getTime() +
      24 * 60 * 60 * 1000
  );

  return {
    createdAt: {
      $gte: start,
      $lt: end,
    },
  };
};

const getUpdatedDateFilter = (fromDate, toDate) => {
  if (!fromDate || !toDate) {
    return {};
  }

  const createdFilter = getDateFilter(fromDate, toDate);

  return {
    updatedAt: createdFilter.createdAt,
  };
};

module.exports = {
    getDateFilter,
    getUpdatedDateFilter,
};