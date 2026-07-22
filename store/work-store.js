let state = {
  caregiver: null,
  selectedPatientId: "",
  networkOnline: true,
  realtimeConnected: false
};

const listeners = [];

const initialize = initialState => {
  state = Object.assign({}, state, initialState || {});
};

const getState = () => Object.assign({}, state);

const setState = patch => {
  state = Object.assign({}, state, patch || {});
  listeners.slice().forEach(listener => listener(getState()));
};

const subscribe = listener => {
  if (typeof listener !== "function") return () => {};
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
};

module.exports = { initialize, getState, setState, subscribe };

