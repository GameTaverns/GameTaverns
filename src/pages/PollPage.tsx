import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PollVotingPage } from "@/components/polls/PollVotingPage";
import { BackLink } from "@/components/navigation/BackLink";

export default function PollPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <Layout>
        <BackLink fallback="/dashboard" />
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">{t('pollPage.invalidLink')}</h1>
          <p className="text-muted-foreground">{t('pollPage.invalidLinkDesc')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <BackLink fallback="/dashboard" />
      <PollVotingPage shareToken={token} />
    </Layout>
  );
}
