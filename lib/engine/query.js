/**
 * 时间切片：某一年「在场」的节点。
 * `from: null` 表示 −∞（一直存在），`to: null` 表示 +∞（至今）；两端都包含。
 * 刻意不排序：保持调用方（store.listNodes）的顺序，界面与测试都依赖这个顺序。
 */
export function stateAt(nodes, year) {
    return nodes.filter((n) => {
        const from = n.span.from ?? -Infinity;
        const to = n.span.to ?? Infinity;
        return year >= from && year <= to;
    });
}
