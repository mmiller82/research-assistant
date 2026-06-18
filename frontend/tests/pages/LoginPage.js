export class LoginPage {
  constructor(page) {
    this.page = page;
    this.authModal = page.locator('#auth-modal');
    this.heading = page.locator('#auth-heading');
    this.subtitle = page.locator('#auth-subtitle');
    this.signInButton = page.locator('#btn-signin');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
  }
}
