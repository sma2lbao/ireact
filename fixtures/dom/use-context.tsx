import React, { useContext, createContext, useState } from "react";
import { createRoot } from "react-dom/client";

console.log(React);

const ctx = React.createContext(0);

function App() {
  const [number, setNumber] = useState(0);

  return (
    <ctx.Provider value={number}>
      <div onClick={() => setNumber(Math.random())}>
        <Middle />
      </div>
    </ctx.Provider>
  );
}

function Middle() {
  return <Child />;
}

function Child() {
  const val = useContext(ctx);
  return <p>{val}</p>;
}

createRoot(document.getElementById("root")!).render(<App />);
