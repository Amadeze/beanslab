import json

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page_errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )

    live_response = context.request.get(f"{BASE_URL}/api/health/live")
    assert live_response.ok, f"Liveness returned {live_response.status}"

    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').wait_for(state="visible")
    page.locator('input[type="password"]').wait_for(state="visible")
    page.get_by_role("button").first.wait_for(state="visible")

    page.goto(f"{BASE_URL}/penjualan/kontrak")
    page.wait_for_load_state("networkidle")
    assert page.url.startswith(f"{BASE_URL}/login"), (
        f"Protected contract route did not redirect to login: {page.url}"
    )

    page.goto(f"{BASE_URL}/register")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').wait_for(state="visible")

    assert not page_errors, f"Browser page errors: {page_errors}"
    assert not console_errors, f"Browser console errors: {console_errors}"

    print(
        json.dumps(
            {
                "liveness": live_response.status,
                "login": "rendered",
                "protectedContractRoute": "redirected",
                "register": "rendered",
                "pageErrors": page_errors,
                "consoleErrors": console_errors,
            },
            indent=2,
        )
    )
    browser.close()
