import { createContext, useContext, useState } from "react";

const CounterModeContext = createContext({
  counterMode: false,
  setCounterMode: () => {},
});

export function CounterModeProvider({ children }) {
  const [counterMode, setCounterMode] = useState(false);
  return (
    <CounterModeContext.Provider value={{ counterMode, setCounterMode }}>
      {children}
    </CounterModeContext.Provider>
  );
}

export const useCounterMode = () => useContext(CounterModeContext);
