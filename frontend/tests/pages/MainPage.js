export class MainPage {
  constructor(page) {
    this.page = page;
    this.headerHeading = page.locator('#header-heading');
    this.inputForm = page.locator('#input-form');
    this.topicInput = page.locator('#topic');
    this.analystInput = page.locator('#maxAnalysts');
    this.feedbackInput = page.locator('#feedback');
    this.startButton = page.locator('#btn-primary');
    this.userInfo = page.locator('#user-info');
    this.signOutButton = page.locator('#btn-signout');
  }

  async injectAuthUser(apiKey, user) {
    await this.page.goto('/');
    await this.page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [`firebase:authUser:${apiKey}:[DEFAULT]`, JSON.stringify(user)]
    );
    await this.page.reload();
  }
}
