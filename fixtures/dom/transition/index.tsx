import React from "react";
import { createRoot } from "react-dom/client";

import { useState, useTransition } from "react";
import Button from "./button";
import About from "./about";
import Posts from "./posts";
import Connect from "./connect";
import "./style.css";

function App() {
  const [number, setNumber] = useState(0);
  return (
    <ul onClick={() => setNumber((number) => number + 1)}>
      {number >= 0 && <li>000000</li>}
      {number >= 1 && <li>111111</li>}
      {number >= 2 && <li>222222</li>}
      <li>aaaaaa</li>
      <li>bbbbbb</li>
      <li>cccccc</li>
      <li>dddddd</li>
      <li>eeeeee</li>
    </ul>
  );

  // const [isPending, startTransition] = useTransition();
  // const [tab, setTab] = useState("about");
  // function selectTab(nextTab) {
  //   // startTransition(() => {
  //   setTab(nextTab);
  //   // });
  // }
  // return (
  //   <div>
  //     <div>
  //       <Button
  //         key="home"
  //         isActive={tab === "about"}
  //         onClick={() => selectTab("about")}
  //       >
  //         首页
  //       </Button>
  //       <Button
  //         key="blog"
  //         isActive={tab === "posts"}
  //         onClick={() => selectTab("posts")}
  //       >
  //         博客 (render慢)
  //       </Button>
  //       <Button
  //         key="contact"
  //         isActive={tab === "contact"}
  //         onClick={() => selectTab("contact")}
  //       >
  //         联系我
  //       </Button>
  //     </div>
  //     <div>
  //       {tab === "about" && <About />}
  //       {tab === "posts" && <Posts />}
  //       {tab === "contact" && <Connect />}
  //     </div>
  //   </div>
  // );
}

const root = createRoot(document.querySelector("#root")!);

root.render(<App />);
