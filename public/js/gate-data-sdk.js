// Cloudflare Pages + D1 dataSdk replacement.
  // This mimics Canva's dataSdk so the existing GATE app can keep working.
  (function () {
    const API_URL = '/api/records';
    let handlerRef = null;
    let lastPayload = '';

    async function fetchRecords() {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      const result = await response.json();

      if (!result.isOk) {
        throw new Error(result.error || 'Failed to fetch records.');
      }

      return result.records || [];
    }

async function refresh(force = false) {
  const records = await fetchRecords();
  const payload = JSON.stringify(records);

  if (!force && payload === lastPayload) {
    return records;
  }

  lastPayload = payload;

  if (handlerRef && typeof handlerRef.onDataChanged === 'function') {
    handlerRef.onDataChanged(records);
  }

  return records;
}

    window.dataSdk = {
      async init(handler) {
        handlerRef = handler;

        await refresh(true);

        setInterval(() => {
          refresh().catch(err => {
            console.error('GATE refresh failed:', err);
          });
        }, 3000);

        return { isOk: true };
      },

      async create(record) {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(record)
        });

        const result = await response.json();

        if (result.isOk) {
          await refresh(true);
        }

        return result;
      },

      async update(record) {
        const response = await fetch(API_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(record)
        });

        const result = await response.json();

        if (result.isOk) {
          await refresh(true);
        }

        return result;
      },

      async delete(record) {
        const response = await fetch(API_URL, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(record)
        });

        const result = await response.json();

        if (result.isOk) {
          await refresh(true);
        }

        return result;
      }
    };
  })();
