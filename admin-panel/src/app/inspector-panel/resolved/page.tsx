'use client';

import { Suspense } from 'react';
import InspectorReportList from '../_components/ReportList';
import { LoadingCenter } from '../../../components/admin/AdminUIKit';

export default function InspectorResolvedPage() {
  return (
    <Suspense fallback={<LoadingCenter />}>
    <InspectorReportList
      heroBadge="Arşiv"
      title="Tamamlananlar"
      subtitle="Onaylanan, reddedilen ve çözülen tüm ihbarların geçmişi."
      defaultStatuses={['APPROVED', 'REJECTED', 'RESOLVED']}
      allowedFilters={['APPROVED', 'REJECTED', 'RESOLVED']}
      emptyMessage="Tamamlanan ihbar bulunmuyor"
    />
    </Suspense>
  );
}
