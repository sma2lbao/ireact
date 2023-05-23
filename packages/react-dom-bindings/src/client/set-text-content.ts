import { TEXT_NODE } from "./html-node-type";

/**
 * 设置节点的textContent属性。对于文本更新，直接设置text节点的' nodeValue '比使用'更快。
 * textContent '，它将删除现有节点并创建一个新节点。
 * @param node
 * @param text
 * @returns
 */
function setTextContent(node: Element, text: string): void {
  if (text) {
    const firstChild = node.firstChild;

    if (
      firstChild &&
      firstChild === node.lastChild &&
      firstChild.nodeType === TEXT_NODE
    ) {
      firstChild.nodeValue = text;
      return;
    }
  }
  node.textContent = text;
}

export default setTextContent;
