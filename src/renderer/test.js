let treeStructure = {
  childNodes: [
    {
      id: 1,
      title: 'home',
      parent: null,
      childNodes: [],
    },
    {
      id: 2,
      title: 'about',
      parent: null,
      childNodes: [
        {
          id: 3,
          title: 'team',
          parent: 2,
          childNodes: [],
        },
        {
          id: 4,
          title: 'company',
          parent: 2,
          childNodes: [],
        },
      ],
    },
  ],
};

let flatten = (childNodes = [], level = 1, parent = null) => {
  return Array.prototype.concat
    .apply(
      childNodes.map((node) => ({ ...node, level: level, parent: parent || null })),
      childNodes.map((node) => flatten(node.childNodes || [], level + 1, node.id))
    )
    .map((node) => delete node.childNodes && node);
};

let flat = flatten(treeStructure.childNodes);

console.log(flat);
