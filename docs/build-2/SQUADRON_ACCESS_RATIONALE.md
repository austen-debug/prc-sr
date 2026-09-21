# Squadron authorization rationale

The shared-credential Squadron role has a separate server-delivered HTML page, rather than relying on CSS or JavaScript to hide the operational app. The account must only be able to read the purpose-built restricted board endpoint, verify its own session, and log out. All other APIs and HTML entry points are denied or redirected by server middleware. The dashboard uses positive allowlisting, never a full JSON record followed by field removal. Credentials and signing keys are deployment secrets, not D1 fields or client assets.
