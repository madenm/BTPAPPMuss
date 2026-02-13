import { PageWrapper } from '@/components/PageWrapper';
import { UserAccountButton } from '@/components/UserAccountButton';
import { CRMPipeline } from '@/components/CRMPipeline';

export default function CRMPipelinePage() {
  return (
    <PageWrapper>
      <header className="bg-black/10 backdrop-blur-xl border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl ml-0 md:ml-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 max-md:pl-14">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">
              CRM Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">Gérez vos prospects et automatisez vos workflows</p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 space-y-6 ml-0 md:ml-20 overflow-x-hidden">
        <CRMPipeline />
      </main>
    </PageWrapper>
  );
}
