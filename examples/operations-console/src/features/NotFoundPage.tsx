import { RouterLink } from "@italone/solace";

export function NotFoundPage() {
  return () => (
    <section class="page-stack empty-detail" aria-labelledby="not-found-heading">
      <p class="section-label">Routing</p>
      <h1 id="not-found-heading">Page not found</h1>
      <p>The requested operations view is not available.</p>
      <RouterLink class="text-link" to={{ name: "incidents" }}>
        Go to incident queue
      </RouterLink>
    </section>
  );
}
