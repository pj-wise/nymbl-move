import { CalendarDays, Lock } from "lucide-react";
import { useEffect } from "react";
import { WORKSPACE_LABEL, can } from "@/auth/permissions";
import { useSession } from "@/auth/useSession";
import { TODAY } from "@/domain/dates";
import { DeliveryWorkspace } from "@/features/delivery/DeliveryWorkspace";
import { StaffingWorkspace } from "@/features/staffing/StaffingWorkspace";
import { useStaffingState } from "@/features/staffing/useStaffingState";
import { formatShort } from "@/lib/format";
import { AccountMenu } from "./AccountMenu";
import { IssuesMenu } from "./IssuesMenu";

/**
 * One app, two workspaces. The staffing store lives here so both workspaces read and write the
 * same state; the session (who / which workspace) is separate and never changes staffing data.
 */
export function AppShell() {
  const store = useStaffingState();
  const session = useSession();
  const { state, dispatch, dataset, ctx } = store;
  const { workspace } = session;

  const hasLocalChanges = state.commits.length > 0;

  useEffect(() => {
    document.title = `${workspace ? `${WORKSPACE_LABEL[workspace]} · ` : ""}Staffing · Harbor & Pine`;
  }, [workspace]);

  return (
    // --app-header-h lets sticky columns below size themselves to the space under the header.
    <div className="relative flex h-full min-h-0 min-w-[1200px] flex-col overflow-clip bg-slate-200/70 text-slate-900 [--app-header-h:4.5rem]">
      <a
        href={workspace === "delivery" ? "#workspace" : "#roles"}
        className="sr-only z-50 rounded bg-white px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {workspace === "delivery"
          ? "Skip to your projects"
          : "Skip to open roles"}
      </a>

      <header className="relative z-10 flex h-(--app-header-h) shrink-0 items-center justify-between gap-6 border-b border-slate-300 bg-white px-6 shadow-sm">
        <div className="whitespace-nowrap">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {dataset.company}
          </p>
          <h1 className="text-lg font-semibold outline-none">Staffing</h1>
        </div>
        <div className="flex items-center gap-4 whitespace-nowrap [&>*]:shrink-0">
          <p className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <CalendarDays aria-hidden className="size-4 text-slate-500" />
            Today is Mon {formatShort(TODAY)}, 2026{" "}
            {/* <span className="text-xs text-slate-500">(demo date)</span> */}
          </p>
          {/* <p className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-900 ring-1 ring-violet-200 ring-inset">
            <FlaskConical aria-hidden className="size-3.5" />
            Prototype: changes stay in this tab
          </p> */}
          {workspace === "staffing" && can(session.user, "staffing:assign") && (
            <IssuesMenu store={store} />
          )}
          <AccountMenu
            session={session}
            people={ctx.people}
            onAnnounce={(message) => dispatch({ type: "announce", message })}
            canReset={hasLocalChanges}
            onReset={() => dispatch({ type: "reset" })}
            demoData={
              workspace === "staffing"
                ? {
                    shown: state.showDemoData,
                    onChange: (value) => dispatch({ type: "setShowDemoData", value }),
                  }
                : null
            }
          />
        </div>
      </header>

      {/* The one scroll area: the header stays put, everything below it scrolls together. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {workspace === "staffing" && <StaffingWorkspace store={store} />}
        {workspace === "delivery" && (
          <DeliveryWorkspace store={store} user={session.user} />
        )}
        {workspace === null && (
          <main
            id="workspace"
            className="flex flex-1 items-center justify-center p-10"
          >
            <div className="max-w-sm rounded-xl border border-slate-300 bg-white p-8 text-center shadow-sm">
              <Lock
                aria-hidden
                className="mx-auto mb-3 size-7 text-slate-400"
              />
              <h2 className="text-base font-semibold">No workspace access</h2>
              <p className="mt-1 text-sm text-slate-600">
                {session.user.name} isn't set up for the Resource Manager or
                Delivery Manager workspace.
              </p>
            </div>
          </main>
        )}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {state.announcement}
      </div>
    </div>
  );
}
