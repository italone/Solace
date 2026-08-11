import { RouterLink, useRoute } from "@italone/solace";
import type { ComponentSetupContext } from "@italone/solace";

export function Layout(_props: object, { slots }: ComponentSetupContext) {
  const route = useRoute();

  return () => {
    const currentSection = route.value.name === "incident-detail" ? "incidents" : route.value.name;

    return (
      <div class="console-shell">
        <header class="console-header">
          <div>
            <p class="console-kicker">Reliability workspace</p>
            <p class="console-title">Operations Console</p>
          </div>
          <p class="environment-indicator">
            <span class="environment-indicator__dot" aria-hidden="true" />
            Production
          </p>
        </header>

        <div class="console-body">
          <aside class="console-sidebar" aria-label="Primary navigation">
            <nav class="console-nav">
              <RouterLink
                to={{ name: "overview" }}
                aria-current={currentSection === "overview" ? "page" : undefined}
              >
                Overview
              </RouterLink>
              <RouterLink
                to={{ name: "incidents" }}
                aria-current={currentSection === "incidents" ? "page" : undefined}
              >
                Incidents
              </RouterLink>
              <RouterLink
                to={{ name: "releases" }}
                aria-current={currentSection === "releases" ? "page" : undefined}
              >
                Releases
              </RouterLink>
            </nav>
            <div class="on-call-summary">
              <p class="section-label">Primary on-call</p>
              <p>Maya Chen</p>
              <p class="muted-text">Platform reliability</p>
            </div>
          </aside>

          <main class="console-main" id="main-content">
            {slots.default?.()}
          </main>
        </div>
      </div>
    );
  };
}
