import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [isDeleted, setIsDeleted] = useState(false);
  const divRef = useRef(null);

  console.warn("render divRef", divRef.current);

  useEffect(() => {
    console.warn("useEffect divRef", divRef.current);
  }, []);

  return (
    <div ref={divRef} onClick={() => setIsDeleted(true)}>
      {isDeleted ? null : <Child />}
    </div>
  );
}

function Child() {
  return <p ref={(dom) => console.warn("dom is", dom)}>child</p>;
}

createRoot(document.getElementById("root")!).render(<App />);
