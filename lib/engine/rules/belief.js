const norm = (s) => s.replace(/[\s。！？.!?，,、；;：:''（）()《》…—]/g, '').toLowerCase();
/**
 * R9 的可解释近似：只看 hard 条目、confidence > 0.8，且 belief 文本没有包含
 * 目标命题（没有命题时看标题/别名）。这不是语义判读，漏报改写型冲突是已知的。
 */
export function r9Beliefs(nodes, beliefs) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return beliefs.flatMap((b) => {
        const n = byId.get(b.target);
        if (!n || n.strength !== 'hard' || b.confidence <= 0.8)
            return [];
        const expected = [n.proposition ?? '', n.title, ...n.aliases]
            .map(norm).filter(Boolean);
        const claim = norm(b.content);
        // 句读差异不算冲突；保留一个保守近似：命中命题/标题/别名就不报，避免把转述当谎言。
        if (expected.some((x) => claim.includes(x)))
            return [];
        return [{
                rule: 'R9',
                severity: 'info',
                nodeIds: [n.id, b.id],
                message: `${b.holder} 以 ${b.confidence} 的置信相信「${b.content}」，与 hard 条目「${n.title}」的命题不一致；是误解，还是写漏？`,
                hint: '确认这是认知层的谎言/误解，或修正条目；R9 不做语义判读',
            }];
    });
}
