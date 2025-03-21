export const verifyNodeData = (node, type, children, index = 0) => {
  cy.get(
    `[data-cy="inspector-node-${node.toLowerCase()}"] > .node-length-color`
  )
    .eq(index)
    .realHover()
    .verifyVisibleElement("have.text", `${children}`);
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .node-key`)
    .eq(index)
    .verifyVisibleElement("have.text", node);
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .node-type`)
    .eq(index)
    .verifyVisibleElement("have.text", type);
};

export const openNode = (node, index = 0, time = 1000) => {
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .node-key`)
    .eq(index)
    .click();
  cy.wait(time);
};

export const verifyValue = (node, type, children, index = 0) => {
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .mx-2`)
    .eq(index)
    .realHover()
    .verifyVisibleElement("contain.text", `${children}`);
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .node-key`)
    .eq(index)
    .verifyVisibleElement("contain.text", node);
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .mx-1`)
    .eq(index)
    .verifyVisibleElement("contain.text", type);
};
export const deleteComponentFromInspector = (node) => {
  cy.get('[data-cy="inspector-node-components"] > .node-key').click();
  cy.get(`[data-cy="inspector-node-${node}"] > .node-key`).realHover().parent().find('[style="height: 13px; width: 13px;"] > img').click();
};

export const verifyfunctions = (node, type, index = 0) => {
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .fs-10`)
    .eq(index)
    .realHover()
    .verifyVisibleElement("contain.text", `${type}`);
  cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .node-key`)
    .eq(index)
    .verifyVisibleElement("contain.text", node);
  // cy.get(`[data-cy="inspector-node-${node.toLowerCase()}"] > .mx-1`)
  //   .eq(index)
  //   .verifyVisibleElement("contain.text", type);
};

export const verifyNodes = (nodes, verificationFunction) => {
  nodes.forEach(node => verificationFunction(node.key, node.type, node.value));
};

export const openAndVerifyNode = (nodeName, nodes, verificationFunction) => {
  openNode(nodeName);
  verifyNodes(nodes, verificationFunction);
};