import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [number, setNum] = React.useState(0);

  React.useEffect(() => {
    console.log("App mount");
  }, []);

  React.useEffect(() => {
    console.log("num change create", number);
    return () => {
      console.log("num change destroy", number);
    };
  }, [number]);

  const handleClick = () => {
    setNum((num) => num + 1);
  };

  return <div onClick={handleClick}>{number === 0 ? <Child /> : "noop"}</div>;
}

function Child() {
  React.useEffect(() => {
    console.log("Child mount");
    return () => console.log("Child unmount");
  }, []);
  return <div>i am child</div>;
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
