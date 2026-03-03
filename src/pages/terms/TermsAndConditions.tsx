import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParticlesBackground } from "@/components/shared/ParticlesBackground";

export default function TermsAndConditions() {
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
              Terms & Conditions
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
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Tradescale, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use this platform.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              2. Service Description and Paid Product Disclaimers
            </h2>
            <p>
              Tradescale is a trade journaling platform that allows users to log, store, and analyze their own trading information, including trade details, screenshots, account information, business metrics, and other related data. The platform also provides tools such as a lot size calculator, news calendar, filtering features, and a trade copier for futures accounts.
            </p>
            <p className="mt-2">
              <strong>All paid products and features, including but not limited to Trade Journaling and Trade Copier for Futures, are provided "AS IS" and "AS AVAILABLE" without warranties of any kind, either express or implied.</strong>
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Trade Journaling:</strong> Tradescale is not liable for the accuracy, completeness, correctness, or reliability of any data displayed, stored, calculated, or processed within the trade journaling system. This includes but is not limited to: trade entry prices, exit prices, profit/loss calculations, statistics, performance metrics, account balances, or any other numerical or textual data. You are solely responsible for verifying the accuracy of all information.
              </li>
              <li>
                <strong>Trade Copier for Futures:</strong> The trade copier functionality is an automated system designed to replicate trades from a leader account to one or more follower accounts. Tradescale is not liable for any aspect of the trade copier's operation, including but not limited to: failure to copy trades, delayed trade execution, incorrect position sizing, missed orders, duplicate orders, partial fills, incorrect entry/exit prices, slippage, connection failures, API errors, account synchronization issues, or any other technical malfunctions that may result in financial losses.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              3. User Responsibility
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                You are solely responsible for the accuracy and completeness of all information, data, and images you enter or upload to Tradescale.
              </li>
              <li>
                Tradescale does not provide financial, investment, or trading advice. All information and tools are for informational and journaling purposes only.
              </li>
              <li>
                You are responsible for any decisions or actions you take based on your use of this platform.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              4. Comprehensive Disclaimers for Paid Products: Trade Copier and Trade Journaling
            </h2>
            <p className="mb-3">
              <strong>BY USING ANY OF TRADESCALE'S PAID PRODUCTS OR FEATURES, YOU ACKNOWLEDGE AND ACCEPT FULL RESPONSIBILITY FOR ALL RISKS, LOSSES, DAMAGES, AND CONSEQUENCES THAT MAY ARISE FROM THEIR USE. YOU AGREE THAT TRADESCALE BEARS NO LIABILITY WHATSOEVER FOR THE PERFORMANCE, ACCURACY, RELIABILITY, OR OUTCOMES OF THESE PRODUCTS.</strong>
            </p>
            <h3 className="font-semibold text-md mt-4 mb-2" style={{ color: "#94bba3" }}>
              4B. Trade Copier for Futures - Comprehensive Liability Waiver
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>The Trade Copier is an automated system that replicates trades from a "leader" account to one or more "follower" accounts. This functionality is provided "AS IS" with NO guarantees of performance, reliability, accuracy, speed, or functionality.</strong>
              </li>
              <li>
                <strong>Tradescale shall not be held accountable, liable, or responsible under any circumstances if the Trade Copier:</strong>
                <ul className="list-circle pl-5 mt-1 space-y-1">
                  <li>Fails to copy trades from leader to follower accounts</li>
                  <li>Copies trades with incorrect position sizes, quantities, or leverage</li>
                  <li>Executes trades at incorrect prices, with significant slippage, or at unfavorable market conditions</li>
                  <li>Delays trade execution resulting in missed opportunities or increased losses</li>
                  <li>Duplicates orders, creates partial fills, or generates unintended positions</li>
                  <li>Fails to close positions when the leader closes their positions</li>
                  <li>Misinterprets market orders, limit orders, stop orders, or any other order types</li>
                  <li>Displays orders, positions, prices, or account information incorrectly, inaccurately, or incompletely in the user interface</li>
                  <li>Experiences connection failures, API errors, timeout issues, or technical malfunctions</li>
                  <li>Fails to synchronize properly between leader and follower accounts</li>
                  <li>Causes margin calls, account liquidations, or broker violations</li>
                  <li>Results in any financial losses, missed profits, or account damage of any kind</li>
                </ul>
              </li>
              <li>
                <strong>You understand that the Trade Copier relies on third-party APIs, broker connections, internet connectivity, and external systems that are beyond Tradescale's control.</strong> Tradescale is not responsible for failures, errors, or disruptions caused by these third-party services.
              </li>
              <li>
                <strong>You are solely and exclusively responsible for:</strong>
                <ul className="list-circle pl-5 mt-1 space-y-1">
                  <li>Monitoring all trade copying activities in real-time</li>
                  <li>Verifying that trades are copied correctly and at acceptable prices</li>
                  <li>Managing position sizes, risk levels, and account balances</li>
                  <li>Ensuring sufficient margin and account funds in follower accounts</li>
                  <li>Complying with all broker rules, margin requirements, and trading regulations</li>
                  <li>Manually intervening if the Trade Copier malfunctions or behaves unexpectedly</li>
                  <li>Any and all consequences, losses, or damages resulting from Trade Copier usage</li>
                </ul>
              </li>
              <li>
                <strong>Futures trading is extremely high-risk and can result in substantial financial losses exceeding your initial investment.</strong> The Trade Copier does not reduce this risk and may amplify losses if it malfunctions. You accept all trading risks voluntarily.
              </li>
              <li>
                <strong>You expressly waive any right to hold Tradescale liable for Trade Copier malfunctions, errors, or failures, regardless of whether such issues result from software bugs, technical problems, user error, or any other cause.</strong>
              </li>
            </ul>

            <h3 className="font-semibold text-md mt-4 mb-2" style={{ color: "#94bba3" }}>
              4C. Trade Journaling - No Liability for Data Accuracy
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Tradescale is not liable for the correctness, accuracy, completeness, or reliability of any data displayed, calculated, stored, or processed within the trade journaling system.</strong> This includes but is not limited to:
                <ul className="list-circle pl-5 mt-1 space-y-1">
                  <li>Trade entry prices, exit prices, and average prices</li>
                  <li>Profit/loss calculations, win rates, and performance statistics</li>
                  <li>Account balance tracking, equity curves, and drawdown calculations</li>
                  <li>Risk/reward ratios, expectancy metrics, and other analytics</li>
                  <li>Trade timestamps, durations, and execution details</li>
                  <li>Any imported data from brokers, trading platforms, or third-party sources</li>
                </ul>
              </li>
              <li>
                <strong>You are solely responsible for verifying the accuracy of all data entered into or generated by the trade journaling system.</strong> Tradescale makes no guarantee that calculations, statistics, or reports are correct.
              </li>
              <li>
                Data discrepancies, calculation errors, or inaccuracies may occur due to software bugs, user input errors, data import issues, or other technical problems. Tradescale is not responsible for any consequences resulting from inaccurate data.
              </li>
              <li>
                You acknowledge that the trade journaling feature is a tool for record-keeping and analysis only, and does not provide trading advice or guarantees of trading success.
              </li>
            </ul>

            <h3 className="font-semibold text-md mt-4 mb-2" style={{ color: "#94bba3" }}>
              4D. User Responsibility and Assumption of Risk
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>You acknowledge that you are using Tradescale's paid products voluntarily and at your own risk.</strong> You assume full responsibility for all trading decisions, financial outcomes, and consequences resulting from your use of these products.
              </li>
              <li>
                <strong>Tradescale is NOT liable for user mistakes, misuse of software, lack of understanding, failure to monitor accounts, or any other user-related errors.</strong> It is your responsibility to understand how the software works and to use it correctly.
              </li>
              <li>
                You agree not to hold Tradescale responsible for losses resulting from your own actions, inactions, mistakes, misunderstandings, or failure to properly configure or monitor the software.
              </li>
              <li>
                <strong>By subscribing to or purchasing any paid product, you confirm that you have read, understood, and accept all disclaimers, limitations of liability, and risks described in these Terms and Conditions.</strong>
              </li>
              <li>
                Trading, especially with automated tools like the Trade Copier, involves substantial risk of loss. Past performance does not guarantee future results. You should never trade with money you cannot afford to lose.
              </li>
            </ul>

            <h3 className="font-semibold text-md mt-4 mb-2" style={{ color: "#94bba3" }}>
              4E. Security of Access Tokens
            </h3>
            <p>
              Tradescale uses short-lived access tokens to facilitate trade copying and other platform functionality. These access tokens may be issued and/or provided through third-party brokers and trading platforms (including, but not limited to, NinjaTrader, Tradovate, TopstepX, and others). While these tokens are designed to minimize exposure and protect your accounts, you acknowledge that in rare circumstances, including device compromise, network vulnerabilities, or browser-based issues, access tokens could potentially be exposed. Tradescale is not responsible for any losses, unauthorized trades, or other consequences resulting from such rare exposures. You are solely responsible for maintaining the security of your devices, accounts, and credentials.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              5. No Liability for Tools and Calculators
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Tradescale provides a trading lot size calculator and other tools for your convenience. While we strive for accuracy, we do not guarantee the correctness or suitability of any calculations or results.
              </li>
              <li>
                You agree that Tradescale and its owners are not liable for any losses, damages, or consequences resulting from the use of these tools, even if they are incorrect or malfunction.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              6. News Calendar and Data
            </h2>
            <p>
              The news calendar and any market data provided are for informational purposes only. Tradescale does not guarantee the accuracy, completeness, or timeliness of any news or data.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              7. Subscription, Payments, and Refunds
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Tradescale operates on a subscription basis via Stripe. Your subscription will remain active until the end of the current billing period after cancellation.
              </li>
              <li>
                <strong>No refunds</strong> are provided for any payments made, including partial months or unused time.
              </li>
              <li>
                You are responsible for managing your subscription and cancellations.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              7A. Service Termination and Data Deletion
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Tradescale reserves the right to terminate, suspend, or discontinue the service at any time, with or without notice, for any reason including but not limited to maintenance, updates, or permanent closure.
              </li>
              <li>
                <strong>Upon service termination or closure, all user data, including but not limited to trade logs, screenshots, account information, and any other uploaded content, may be permanently deleted without prior notice or opportunity for data retrieval.</strong>
              </li>
              <li>
                You acknowledge and agree that Tradescale has no obligation to retain, provide, export, or return any of your data upon service termination, account cancellation, or platform closure.
              </li>
              <li>
                It is your sole responsibility to regularly backup and export any data you wish to retain. Tradescale is not responsible for any data loss resulting from service termination or closure.
              </li>
              <li>
                By using this service, you waive any right to claim, demand, or request your data from Tradescale after service termination or if you are unable to access the platform for any reason.
              </li>
            </ul>
          </section>
         <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              8. Data Ownership and User Rights
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                While you retain ownership of the content you upload, by using Tradescale, you grant us an unlimited, worldwide, royalty-free license to store, process, and delete your data as necessary for platform operations.
              </li>
              <li>
                You acknowledge that Tradescale is provided as a convenience service and that you have <strong>no inherent right to access, retrieve, or demand your data</strong> if the service becomes unavailable, is terminated, or if you lose access to your account.
              </li>
              <li>
                Tradescale does not guarantee data availability, backup services, or data export functionality at any time. Any data export features provided are offered as a courtesy and may be removed or become unavailable without notice.
              </li>
              <li>
                You waive any claims related to data loss, data inaccessibility, or inability to retrieve your information for any reason whatsoever.
              </li>
            </ul>
          </section>
         <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              9. Comprehensive Limitation of Liability
            </h2>
            <p>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRADESCALE, ITS OWNERS, OPERATORS, EMPLOYEES, AFFILIATES, PARTNERS, AND SERVICE PROVIDERS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES ARISING FROM YOUR USE OF THE PLATFORM OR ANY PAID PRODUCTS.</strong>
            </p>
            <p className="mt-2">
              This limitation of liability includes, but is not limited to:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Trading losses, missed profits, or financial damages</strong> of any kind resulting from use of the Trade Copier, Trade Journaling, or any other feature
              </li>
              <li>
                <strong>Data inaccuracies, calculation errors, or incorrect information</strong> displayed or generated by any Tradescale feature
              </li>
              <li>
                <strong>Software malfunctions, bugs, errors, crashes, or failures</strong> affecting any paid or free product
              </li>
              <li>
                <strong>Trade Copier failures, delays, incorrect executions, or malfunctions</strong> that result in financial losses or missed opportunities
              </li>
              <li>
                <strong>Loss of data, inability to access data, or data corruption</strong> for any reason whatsoever
              </li>
              <li>
                <strong>Service interruptions, downtime, maintenance periods, or permanent service termination</strong>
              </li>
              <li>
                <strong>Third-party API failures, broker connection issues, or external service disruptions</strong>
              </li>
              <li>
                <strong>Account liquidations, margin calls, broker violations, or regulatory issues</strong> resulting from Trade Copier usage
              </li>
              <li>
                <strong>Business interruption, lost revenue, or opportunity costs</strong> of any nature
              </li>
              <li>
                <strong>Any damages exceeding the amount you paid for your Tradescale subscription in the 12 months preceding the claim</strong>
              </li>
            </ul>
            <p className="mt-2">
              The Propfirm Ruletracker feature displays the current rules of various prop firms for informational purposes only. Tradescale does not guarantee that these rules are up-to-date, correct, or applicable to your situation. If any information is outdated or incorrect, Tradescale is not liable. Users are responsible for conducting their own research and verifying all prop firm rules independently.
            </p>
            <p className="mt-2">
              <strong>You expressly agree that Tradescale bears no responsibility for any loss of data, and you have no recourse against Tradescale for data loss or inaccessibility under any circumstances.</strong>
            </p>
            <p className="mt-2">
              <strong>You further agree that Tradescale is not liable for any consequences resulting from user errors, misuse of the platform, failure to understand how features work, or failure to properly monitor automated systems like the Trade Copier.</strong> All risks associated with using Tradescale's products are assumed entirely by you.
            </p>
            <p className="mt-2">
              <strong>SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS, EXCLUSIONS, OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS. HOWEVER, TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE LIMITATIONS SET FORTH IN THIS SECTION SHALL APPLY.</strong>
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              10. Changes to Terms
            </h2>
            <p>
              Tradescale reserves the right to update or modify these Terms and Conditions at any time. Continued use of the platform constitutes acceptance of any changes.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-lg mb-2" style={{ color: "#94bba3" }}>
              11. Contact
            </h2>
            <p>
              For questions or concerns regarding these Terms and Conditions, please contact us at{" "}
              <a href="mailto:apptradescale@gmail.com" className="underline" style={{ color: "#94bba3" }}>
                apptradescale@gmail.com
              </a>.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}