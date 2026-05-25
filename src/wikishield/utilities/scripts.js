module.exports.sortDependencies = function sortDependencies(items) {
    const map = new Map(items.map(item => [ item.id, item ]));

    const visited = new Set();
    const stack = new Set();

    const result = [ ];

    const visit = (id, path) => {
        if (visited.has(id))
            return;
        else if (stack.has(id)) {
            const start = path.indexOf(id);
            const cycle = path.slice(start).concat(id).join(" -> ");
            throw new Error(`Cyclic dependency detected: ${cycle}`);
        }

        const node = map.get(id);
        if (!node)
            throw new Error(`Unknown dependency: ${id}`);

        stack.add(id);
        path.push(id);

        const dependencies = node.dependencies || [ ];
        for (const dependency of dependencies)
            visit(dependency, path);

        path.pop();

        visited.add(id);
        stack.delete(id);

        result.push(node);
    }

    for (const item of items)
        if (!visited.has(item.id))
            visit(item.id, [ ]);

    return result;
}