import Link from 'next/link';
import Image from 'next/image';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Nav */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="rounded-xl bg-white p-1.5 shadow-sm border border-[rgba(0,0,0,0.08)] flex-shrink-0">
              <Image src="/collabdocs-logo-full.png" alt="CollabDocs" width={662} height={216} className="h-8 w-auto object-contain" />
            </div>
          </Link>
          <Link
            href="/signup"
            className="text-[13px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[32px] font-bold text-[#111827] tracking-tight">
            Terms of Service &amp; Privacy Policy
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#6B7280]">
            <span>Effective Date: April 28, 2026</span>
            <span className="text-[#D1D5DB]">•</span>
            <span>Version 1.0</span>
            <span className="text-[#D1D5DB]">•</span>
            <span>Student Project</span>
          </div>
          <div className="mt-5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-5 py-4">
            <p className="text-[13px] text-[#1D4ED8] leading-relaxed">
              <span className="font-semibold">Note:</span> CollabDocs is a student project built for educational purposes. It is not a commercial product. These terms are written in plain English and are designed to be fair and transparent.
            </p>
          </div>
        </div>

        {/* TOC */}
        <nav className="mb-12 rounded-xl border border-[#E5E7EB] bg-white p-6">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-4">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[13px]">
            <a href="#tos" className="text-[#3B82F6] hover:underline font-medium">Part 1 — Terms of Service</a>
            <a href="#privacy" className="text-[#3B82F6] hover:underline font-medium">Part 2 — Privacy Policy</a>
            <a href="#tos-1" className="text-[#6B7280] hover:text-[#111827]">1. Who We Are</a>
            <a href="#pp-1" className="text-[#6B7280] hover:text-[#111827]">1. What Data We Collect</a>
            <a href="#tos-5" className="text-[#6B7280] hover:text-[#111827]">5. Acceptable Use</a>
            <a href="#pp-4" className="text-[#6B7280] hover:text-[#111827]">4. Cookies &amp; Local Storage</a>
            <a href="#tos-6" className="text-[#6B7280] hover:text-[#111827]">6. Your Content</a>
            <a href="#pp-7" className="text-[#6B7280] hover:text-[#111827]">7. Your Rights</a>
            <a href="#contact" className="text-[#6B7280] hover:text-[#111827]">Contact</a>
          </div>
        </nav>

        {/* Part 1 */}
        <section id="tos" className="mb-14">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-[#E5E7EB]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] whitespace-nowrap">Part 1 — Terms of Service</h2>
            <div className="h-px flex-1 bg-[#E5E7EB]" />
          </div>

          <div className="space-y-10">
            <section id="tos-1">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">1. Who We Are</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                CollabDocs is a real-time collaborative document editor built as a student project. It is developed and maintained by a student developer (referred to as "we," "us," or "our"). CollabDocs is not a registered company or commercial entity.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">2. Acceptance of Terms</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                By creating an account or using CollabDocs, you agree to these Terms of Service. If you do not agree, please do not use the platform. These terms apply to all users, including visitors, registered users, and collaborators.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">3. What CollabDocs Does</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">CollabDocs allows you to:</p>
              <ul className="space-y-2">
                {[
                  'Create, edit, and save text documents',
                  'Collaborate with others on documents in real time',
                  'Share documents with other users via link or direct invite',
                  'Sign in using your Google account or email and password',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">4. Your Account</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials. You agree not to share your login details with others. We reserve the right to suspend or delete accounts that violate these terms. You must be at least 13 years old to use CollabDocs.
              </p>
            </section>

            <section id="tos-5">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">5. Acceptable Use</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">You agree <span className="font-semibold">NOT</span> to use CollabDocs to:</p>
              <ul className="space-y-2 mb-3">
                {[
                  'Upload or share illegal, harmful, or offensive content',
                  'Harass, threaten, or impersonate other users',
                  'Attempt to hack, reverse-engineer, or disrupt the platform',
                  'Spam other users or use the platform for commercial advertising',
                  'Violate any applicable laws or regulations',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                We reserve the right to remove content and terminate accounts that violate these rules without prior notice.
              </p>
            </section>

            <section id="tos-6">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">6. Your Content</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                You own the content you create on CollabDocs. By using the platform, you grant us a limited, non-exclusive license to store and display your content solely for the purpose of providing the service. We do not claim ownership of your documents.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">7. Service Availability</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                CollabDocs is a student project and is provided "as is." We do not guarantee 100% uptime or availability. The service may go offline for maintenance, updates, or due to technical issues. We are not liable for any loss of data or inconvenience caused by downtime.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">8. Termination</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                You can delete your account at any time. We may also suspend or terminate your account if you violate these terms. Upon termination, your documents may be deleted from our servers.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">9. Limitation of Liability</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                Since CollabDocs is a free student project, we are not liable for any damages, data loss, or issues arising from your use of the platform. Use it at your own risk, and please keep backups of important documents.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">10. Changes to Terms</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                We may update these terms occasionally. If we make significant changes, we will notify users via email or an in-app notice. Continued use of CollabDocs after changes means you accept the updated terms.
              </p>
            </section>
          </div>
        </section>

        {/* Part 2 */}
        <section id="privacy" className="mb-14">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-[#E5E7EB]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] whitespace-nowrap">Part 2 — Privacy Policy</h2>
            <div className="h-px flex-1 bg-[#E5E7EB]" />
          </div>

          <div className="space-y-10">
            <section id="pp-1">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">1. What Data We Collect</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">We collect the following information when you use CollabDocs:</p>
              <ul className="space-y-2">
                {[
                  'Account information: your name, email address, and profile picture (from Google OAuth or sign-up form)',
                  'Document data: the content of documents you create or collaborate on',
                  'Usage data: timestamps of logins, document edits, and sharing activity',
                  'Device info: browser type and rough location (country/region) for security purposes',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">2. Why We Collect It</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">We use your data only to:</p>
              <ul className="space-y-2 mb-3">
                {[
                  'Provide and operate the CollabDocs service',
                  'Enable real-time collaboration features',
                  'Send account-related emails (e.g., password reset, login alerts)',
                  'Improve the platform based on how it is used',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[14px] font-medium text-[#111827]">We do NOT use your data for advertising, profiling, or sell it to any third party.</p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">3. Google Sign-In</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                If you choose to sign in with Google, we receive your name, email address, and profile picture from Google. We do not receive or store your Google password. Your use of Google Sign-In is also governed by Google's Privacy Policy.
              </p>
            </section>

            <section id="pp-4">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">4. Cookies &amp; Local Storage</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">CollabDocs uses:</p>
              <ul className="space-y-2 mb-3">
                {[
                  'Session cookies to keep you logged in',
                  'Local storage to save editor preferences and draft states',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[14px] text-[#4B5563]">We do not use third-party tracking cookies or advertising cookies.</p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">5. Data Storage</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                Your data is stored on servers used to host this student project (such as cloud providers like Vercel, Render, or similar platforms). We take reasonable steps to keep your data secure, but as a student project, we cannot guarantee enterprise-level security. Please do not store highly sensitive personal information on CollabDocs.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">6. Data Sharing</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">We do not sell, rent, or share your personal data with third parties, except:</p>
              <ul className="space-y-2">
                {[
                  'With other users when you share a document with them (only the content you choose to share)',
                  'With hosting/infrastructure providers strictly to operate the service',
                  'When required by law',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section id="pp-7">
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">7. Your Rights</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-3">You have the right to:</p>
              <ul className="space-y-2 mb-3">
                {[
                  'Access the data we hold about you — just email us',
                  'Request correction of inaccurate data',
                  'Request deletion of your account and associated data',
                  'Export your documents before deleting your account',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#4B5563]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[14px] text-[#4B5563]">To exercise any of these rights, contact us at the email below.</p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">8. Data Retention</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                We keep your data for as long as your account is active. If you delete your account, we will delete your personal data and documents within 30 days, unless we are required by law to retain it longer.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">9. Children's Privacy</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                CollabDocs is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, please contact us and we will delete it promptly.
              </p>
            </section>

            <section>
              <h3 className="text-[16px] font-semibold text-[#111827] mb-2">10. Changes to This Policy</h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of significant changes via email or an in-app banner. The "Effective Date" at the top of this document will always reflect the latest version.
              </p>
            </section>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="rounded-xl border border-[#E5E7EB] bg-white p-8">
          <h2 className="text-[18px] font-semibold text-[#111827] mb-1">Contact</h2>
          <p className="text-[13px] text-[#6B7280] mb-6">
            This is a student project. If you have any questions, concerns, or requests about these terms or your data, please reach out:
          </p>
          <div className="space-y-2 text-[14px]">
            <div className="flex items-center gap-2">
              <span className="text-[#9CA3AF] w-20 flex-shrink-0 text-[13px]">Email</span>
              <a href="mailto:erusumitkumar45@gmail.com" className="text-[#3B82F6] hover:underline">erusumitkumar45@gmail.com</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#9CA3AF] w-20 flex-shrink-0 text-[13px]">Project</span>
              <span className="text-[#374151]">CollabDocs — Real-Time Collaborative Editor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#9CA3AF] w-20 flex-shrink-0 text-[13px]">Built by</span>
              <span className="text-[#374151]">Sumit Kumar (Student Developer)</span>
            </div>
          </div>
        </section>

        <p className="mt-10 text-center text-[12px] text-[#9CA3AF]">
          © 2026 CollabDocs — Student Project. All rights reserved.
        </p>
      </main>
    </div>
  );
}
