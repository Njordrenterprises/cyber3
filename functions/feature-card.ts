/// <reference lib="dom" />

export function featureCard() {
  return {
    init() {
      // Initialize intersection observer for cards
      const observer = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).classList.add('visible');
            } else {
              (entry.target as HTMLElement).classList.remove('visible');
            }
          });
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 0.1
        }
      );

      // Observe all feature cards
      document.querySelectorAll<HTMLElement>('.feature-card').forEach(card => {
        observer.observe(card);
      });
    },
    async handleAction(_action: string) {
      // Handle feature card actions
    }
  }
} 