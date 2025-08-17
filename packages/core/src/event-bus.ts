export class EventBus {
  private events: unknown[] = []

  emit(event: unknown): void {
    this.events.push(event)
  }
}
