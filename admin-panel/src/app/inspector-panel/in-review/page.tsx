'use client';

import { Suspense } from 'react';
import InspectorReportList from '../_components/ReportList';
import { LoadingCenter } from '../../../components/admin/AdminUIKit';

export default function InspectorInReviewPage() {
  return (
    <Suspense fallback={<LoadingCenter />}>
    <InspectorReportList
      heroBadge="Aktif İnceleme"
      title="İncelemede"
      subtitle="Üzerinde çalıştığınız ihbarlar — onaylayın, reddedin veya markete iletin."
      defaultStatuses={['UNDER_REVIEW']}
      allowedFilters={['UNDER_REVIEW']}
      emptyMessage="İnceleme aşamasında ihbar yok"
    />
    </Suspense>
  );
}
