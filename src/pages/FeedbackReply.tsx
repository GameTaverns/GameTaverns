import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Send, Loader2 } from "lucide-react";

export default function FeedbackReply() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !message.trim()) return;

    setStatus("sending");
    try {
      const { data, error } = await supabase.functions.invoke("submit-feedback-reply", {
        body: { token, message: message.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        setErrorMessage(data.error);
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch (err: any) {
      setErrorMessage(err?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8dcc8] p-4">
        <Card className="max-w-md w-full bg-[#f5eed9] border-[#d4c4a0]">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-[#3d2b1f] font-medium">Invalid reply link</p>
            <p className="text-sm text-[#78705e] mt-2">This link appears to be broken or incomplete.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8dcc8] p-4">
        <Card className="max-w-md w-full bg-[#f5eed9] border-[#d4c4a0]">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#556b2f] mx-auto mb-4" />
            <p className="text-[#3d2b1f] font-medium text-lg">Reply sent!</p>
            <p className="text-sm text-[#78705e] mt-2">
              Our team will review your response. Thank you for your feedback!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e8dcc8] p-4">
      <Card className="max-w-lg w-full bg-[#f5eed9] border-[#d4c4a0]">
        <CardHeader className="bg-[#3d2b1f] rounded-t-lg">
          <div className="text-center">
            <img src="https://gametaverns.com/gt-logo.png" alt="GameTaverns" className="h-10 mx-auto mb-2" />
            <CardTitle className="text-[#e8d9b0] text-lg font-serif">Reply to Staff</CardTitle>
            <CardDescription className="text-[#c4b896]">
              Your response will be added to your feedback ticket
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your reply here..."
              rows={6}
              maxLength={5000}
              className="bg-[#efe5cf] border-[#d4c4a0] text-[#3d2b1f] placeholder:text-[#9a8a6e] focus:border-[#556b2f] resize-none"
              disabled={status === "sending"}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9a8a6e]">{message.length}/5000</span>
              <Button
                type="submit"
                disabled={!message.trim() || status === "sending"}
                className="bg-[#556b2f] hover:bg-[#6b8a3a] text-white"
              >
                {status === "sending" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Send Reply</>
                )}
              </Button>
            </div>
            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
