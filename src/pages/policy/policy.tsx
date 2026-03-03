import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParticlesBackground } from "@/components/shared/ParticlesBackground";

export default function Policy() {
  const navigate = useNavigate();

  return (
    <div className="relative flex justify-center items-start min-h-screen py-10 px-4 bg-background">
      {/* Particles in the background */}
      <div className="absolute inset-0 z-0">
        <ParticlesBackground />
      </div>
      <Card
        className="relative z-10 max-w-3xl w-full bg-black max-h-[90vh] overflow-y-auto"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>
          {`
            .max-w-3xl::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle
              className="font-extrabold text-3xl"
              style={{ color: "#94bba3" }}
            >
              Privacy Policy
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-auto px-2 bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105"
              onClick={() => navigate("/auth/signin")}
            >
              Go Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-white">
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              1. Introduction
            </h2>
            <p>
              This Privacy Policy describes how Tradescale ("we", "us", "our") collects, uses, and protects your personal information when you use our platform and services.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              2. Information We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account Information:</strong> When you register, we collect your name, email address, and other relevant details.
              </li>
              <li>
                <strong>Trading Data:</strong> Information you enter or upload, such as trade details, screenshots, account information, and analytics.
              </li>
              <li>
                <strong>Usage Data:</strong> We collect data about how you use Tradescale, including log files, device information, and cookies.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                To provide, maintain, and improve our services.
              </li>
              <li>
                To personalize your experience and deliver relevant features.
              </li>
              <li>
                To communicate with you regarding updates, support, and account-related matters.
              </li>
              <li>
                To analyze usage and improve platform security.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              4. Data Sharing and Disclosure
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                We do <strong>not</strong> sell, rent, or trade your personal information to third parties.
              </li>
              <li>
                We may share data with trusted service providers who assist in operating our platform (e.g., payment processors, hosting providers), subject to confidentiality agreements.
              </li>
              <li>
                We may disclose information if required by law, regulation, or legal process.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              5. Data Security
            </h2>
            <p>
              Tradescale implements industry-standard security measures to protect your data from unauthorized access, alteration, or disclosure. However, no method of transmission or storage is 100% secure.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              6. Cookies and Tracking Technologies
            </h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage, and improve our services. You can manage your cookie preferences in your browser settings.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              7. Data Retention
            </h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide services. <strong>However, we reserve the right to delete your data at any time, with or without notice, at our sole discretion.</strong> Data retention is not guaranteed, and we make no commitment to preserve your data indefinitely.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              7A. Service Termination and Data Deletion
            </h2>
            <p>
              <strong>In the event that Tradescale discontinues its services or terminates operations for any reason, all user data, including but not limited to account information, trading data, and uploaded content, may be permanently deleted without prior notice. You acknowledge that we have no obligation to retain, transfer, or provide access to your data following service termination.</strong>
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              8. Data Ownership and User Rights
            </h2>
            <p>
              While you retain ownership of the content you upload to Tradescale, <strong>you acknowledge and agree that you have no inherent right to access, retrieve, or demand your data if our services are discontinued, suspended, or terminated.</strong> Any rights to access or retrieve data are contingent upon the continued operation of our services and may be revoked at any time.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Limited Access Rights:</strong> Subject to service availability, you may request to access, correct, or delete your personal information while our services are operational.
              </li>
              <li>
                <strong>No Guaranteed Retention:</strong> We make no guarantee that your data will be retained for any specific period or that it will be available upon request, particularly after account deletion or service termination.
              </li>
              <li>
                <strong>Waiver of Data Recovery Claims:</strong> By using our services, you expressly waive any claims for data recovery, access, or compensation in the event of data loss, service discontinuation, or platform shutdown.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              9. Limitation of Liability for Data Loss
            </h2>
            <p>
              <strong>You expressly agree that Tradescale bears no responsibility for any loss of data, whether due to technical failures, security breaches, service termination, or any other cause. We are not liable for any damages, losses, or claims arising from the unavailability, deletion, or corruption of your data.</strong> You are solely responsible for maintaining backups of any critical information.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              10. Changes to This Policy
            </h2>
            <p>
              Tradescale may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on our website.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              11. Contact Us
            </h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or your data, please contact us at{" "}
              <a href="mailtoapptradescale@gmail.com" className="underline" style={{ color: "#94bba3" }}>
               apptradescale@gmail.com
              </a>.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}