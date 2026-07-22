const pad = value => String(value).padStart(2, "0");

const formatDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${formatDate(date)} ${formatTime(date)}`;
};

const formatMonthDay = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const minutesSince = value => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Infinity;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
};

module.exports = { formatDate, formatTime, formatDateTime, formatMonthDay, minutesSince };

