"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PSPPendingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">⏳</div>
        <h1 className="text-2xl font-semibold text-foreground mb-3">Application Under Review</h1>
        <p className="text-sm text-muted-foreground mb-2">
          Your KYB application has been submitted successfully. Our team will review your documents and credit profile within 24-48 hours.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          You&apos;ll receive an email notification once your application is approved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/"><Button variant="outline" className="border-border text-muted-foreground">Back to Home</Button></Link>
          <Link href="/auth"><Button className="bg-blue-400 text-white hover:bg-blue-400/90">Sign In</Button></Link>
        </div>
      </div>
    </div>
  );
}
