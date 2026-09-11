"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { renderBillDocumentHtml } from "@/lib/bills/document-template-html";
import type { BillDocumentModel } from "@/lib/bills/bill-document";

type BillContractDocumentProps = {
  data: BillDocumentModel;
  pages?: ("all" | "contract" | "voucher" | "tax50twi")[];
  className?: string;
};

export function BillContractDocument({
  data,
  pages = ["all"],
  className = "",
}: BillContractDocumentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState("1200px");
  const pageMode = pages[0] || "all";

  const renderedHtml = useMemo(() => {
    return renderBillDocumentHtml(data, pageMode);
  }, [data, pageMode]);

  useEffect(() => {
    function updateHeight() {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          if (doc && doc.body) {
            const h = doc.body.scrollHeight;
            if (h > 100) {
              setIframeHeight(`${h + 40}px`);
            }
          }
        } catch {}
      }
    }

    const timer = setTimeout(updateHeight, 300);
    return () => clearTimeout(timer);
  }, [renderedHtml]);

  return (
    <div className={`bill-contract-exact-document flex flex-col items-center justify-center w-full bg-slate-800/90 p-2 sm:p-6 print:p-0 print:bg-white ${className}`}>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .bill-contract-exact-document,
          .bill-contract-exact-document iframe {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
        }
      `}</style>

      {/* EXACT 100% GOOGLE DOC 3-PAGE CENTERED CONTAINER */}
      <div className="w-full max-w-[225mm] rounded-xl overflow-hidden shadow-2xl border border-slate-700 print:border-none print:shadow-none mx-auto bg-[#525659]">
        <iframe
          ref={iframeRef}
          srcDoc={renderedHtml}
          title="สัญญาจ้างเหมาและหนังสือรับรอง 50 ทวิ"
          className="w-full border-0 block bg-[#525659]"
          style={{ height: iframeHeight, minHeight: "1150px" }}
          onLoad={() => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              try {
                const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
                if (doc && doc.body) {
                  setIframeHeight(`${doc.body.scrollHeight + 40}px`);
                }
              } catch {}
            }
          }}
        />
      </div>
    </div>
  );
}
