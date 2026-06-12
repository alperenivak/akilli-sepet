'use client';

import { Suspense } from 'react';
import InspectorReportList from '../_components/ReportList';
import { LoadingCenter } from '../../../components/admin/AdminUIKit';

export default function InspectorReportsPage() {
  return (
    <Suspense fallback={<LoadingCenter />}>
      <InspectorReportList
        heroBadge="İhbar Kutusu"
        title="Bekleyen İhbarlar"
        subtitle="Denetlenmesi gereken yeni SKT bildirimleri — öncelikli inceleme gerektirenler üstte vurgulanır."
        defaultStatuses={['PENDING']}
        allowedFilters={['PENDING', 'UNDER_REVIEW']}
        emptyMessage="Bekleyen ihbar bulunmuyor 🎉"
        showWorkflowGuide
      />
    </Suspense>
  );
}
