import { defineAsyncComponent } from "@italone/solace";

import { operationsStore } from "../../app/store";

const ReleaseLoadingState = () => (
  <p class="async-state" role="status">
    Loading release activity
  </p>
);

const ReleaseErrorState = () => (
  <p class="async-state async-state--error" role="alert">
    Dependency status unavailable
  </p>
);

const ReleaseTable = () => () => (
  <div
    class="table-scroll"
    role="region"
    tabIndex={0}
    aria-label="Scrollable release activity table"
  >
    <table>
      <caption>Release activity</caption>
      <thead>
        <tr>
          <th scope="col">Release</th>
          <th scope="col">Version</th>
          <th scope="col">Environment</th>
          <th scope="col">Status</th>
          <th scope="col">Released at</th>
        </tr>
      </thead>
      <tbody>
        {operationsStore.state.releases.map((release) => (
          <tr key={release.id}>
            <th scope="row">{release.id}</th>
            <td>{release.version}</td>
            <td>{release.environment}</td>
            <td>
              <span class={`release-status release-status--${release.status}`}>
                {release.status}
              </span>
            </td>
            <td>
              <time dateTime={release.releasedAt}>
                {release.releasedAt.replace("T", " ").replace("Z", " UTC")}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

let recoverableLoadAttempts = 0;

export const RecoverableReleasePanel = defineAsyncComponent({
  loader: () => {
    recoverableLoadAttempts += 1;

    return recoverableLoadAttempts === 1
      ? Promise.reject(new Error("Temporary release dependency failure"))
      : Promise.resolve(ReleaseTable);
  },
  loadingComponent: ReleaseLoadingState,
  errorComponent: ReleaseErrorState,
  retry: 1,
  retryDelay: 10,
});

export const ExhaustedReleasePanel = defineAsyncComponent({
  loader: () => Promise.reject(new Error("Release dependency unavailable")),
  loadingComponent: ReleaseLoadingState,
  errorComponent: ReleaseErrorState,
  retry: 1,
  retryDelay: 10,
});

export default function ReleaseActivityPage() {
  return () => (
    <section class="page-stack" aria-labelledby="release-activity-heading">
      <div class="page-heading">
        <div>
          <p class="section-label">Deployment posture</p>
          <h1 id="release-activity-heading">Release activity</h1>
        </div>
      </div>

      <section class="content-section" aria-labelledby="release-history-heading">
        <h2 id="release-history-heading">Recent deployments</h2>
        <RecoverableReleasePanel />
      </section>

      <section class="content-section" aria-labelledby="dependency-status-heading">
        <h2 id="dependency-status-heading">Dependency status</h2>
        <ExhaustedReleasePanel />
      </section>
    </section>
  );
}
