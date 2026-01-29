import { useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PollVotingPage } from "@/components/polls/PollVotingPage";

export default function PollPage() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Invalid Poll Link</h1>
          <p className="text-muted-foreground">This poll link appears to be invalid.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PollVotingPage shareToken={token} />
    </Layout>
  );
}
