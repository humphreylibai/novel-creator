const firstSentence = (body) => {
    const clean = body.replace(/[#>*_`]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = /^(.{4,80}?[。！？.!?])/.exec(clean);
    return (m?.[1] ?? clean.slice(0, 80)).trim();
};
/** 命题归纳：优先用正文第一句，否则给一句可继续改的占位命题。 */
export function suggestProposition(node) {
    if (node.proposition?.trim())
        return node.proposition.trim();
    const sentence = firstSentence(node.body);
    if (sentence.length >= 6)
        return sentence;
    return node.kind === 'axiom'
        ? `「${node.title}」是这个世界的硬底线，违反它要付出代价。`
        : `「${node.title}」不是孤立的，它必须由一条公理解释。`;
}
/** 审问：按缺口生成问题，不做语义判断。 */
export function interrogate(node, nodes) {
    const q = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    if (node.kind === 'axiom') {
        if (node.cost.length === 0)
            q.push('这条公理让谁付出什么代价？');
        if (node.manifests.length < 2)
            q.push('至少两个能被看见的东西是什么？（仪式、器物、称谓、禁令）');
    }
    else {
        if (node.derives.length === 0)
            q.push('它从哪条公理长出来？');
        if (node.requires.length === 0)
            q.push('它依赖什么才能成立？');
    }
    if (!node.proposition?.trim())
        q.push('用一句可判真假的话说清它，别用形容词。');
    if (node.body.trim().length < 20)
        q.push('它在正文里第一次出现是什么场景？');
    if (node.span.from === null && node.span.to === null)
        q.push('它从什么时候开始存在？之前是什么样？');
    if (node.conflictsWith.length === 0)
        q.push('有没有人/势力反对它？谁最想让它失败？');
    if (node.aliases.length === 0)
        q.push('外人怎么称呼它？有没有讳称或误称？');
    const missingTarget = [...node.derives, ...node.manifests, ...node.requires]
        .filter((id) => !byId.has(id));
    if (missingTarget.length > 0)
        q.push(`这些关系指向了不存在的条目：${missingTarget.join('、')}；补上或删掉。`);
    return q.slice(0, 8);
}
/** 裁决建议：把诊断转成“下一步选哪边”的问题。 */
export function rulingAdvice(finding, nodes) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const names = finding.nodeIds.map((id) => byId.get(id)?.title ?? id);
    if (finding.rule === 'R1' || finding.rule === 'R6') {
        const [a, b] = names;
        return a && b
            ? `「${a}」和「${b}」不能同时为真。选一边：谁赢？输的那边要付出什么代价？`
            : '两处设定互斥。选一边，并写清输的那边会怎样。';
    }
    if (finding.rule === 'R4')
        return '给它指定一条公理；如果它只是装饰，就明确标成装饰，别让它进断言图。';
    if (finding.rule === 'R9')
        return '先确认 holder 是误解还是谎言；如果是谎言，谁在维护它、谁在拆穿它？';
    if (finding.rule === 'R12')
        return '公理不能只停在抽象句：给它挂两个能被看见、能被违反的具体设定。';
    return finding.hint ?? '补一条能验证它的正文，或删掉它。';
}
