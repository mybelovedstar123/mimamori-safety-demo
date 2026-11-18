import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState title="ページが見つかりません" description="URLを確認するか、ダッシュボードへ戻ってください。" />
      <div className="flex justify-center pb-8">
        <ButtonLink to="/" variant="primary">
          ダッシュボードへ
        </ButtonLink>
      </div>
    </Card>
  );
}
