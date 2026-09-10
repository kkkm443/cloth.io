// Both operations wait for database acknowledgement. Retry reuses the saved report
// and its stable intake key; a partial failure is never reported as full success.
export async function saveReportAndIntake(options) {
    const { request, form, automatic, title, body, onReport, onPhase } = options;
    let report = options.existing;
    if (!report) {
        onPhase('report');
        const response = await request('/api/reports', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok || !data.report)
            throw new Error(data.error || '제보를 저장하지 못했어요.');
        report = data.report;
        onReport(report);
    }
    if (!automatic)
        return { report, intake: null };
    onPhase('intake');
    const response = await request('/api/features/intakes/' + report.id, { method: 'POST', body: JSON.stringify({ title, body, mode: 'internal', consent: true, report_revision: report.revision }) });
    const data = await response.json();
    if (!response.ok || !data.intake)
        throw new Error(data.error || '자동 접수 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');
    return { report, intake: data.intake };
}
