// Legacy mirror candidates, not guaranteed working endpoints. Always verify before use.
// Service closures and live-check findings: docs/service-status.md.
export const domains: Record<string, string | null> = {
    // Afghanistan and Pakistan
    'da.azadiradio.com': 'd1o1dnkfyuudx9.cloudfront.net',
    'pa.azadiradio.com': 'd10z1erkm7jz8z.cloudfront.net',
    'www.mashaalradio.com': 'd36fe2ht431omh.cloudfront.net',

    // Azerbaijan
    'www.azadliq.org': 'd2a8xmf1c9fo9h.cloudfront.net',

    // Belarus
    'www.svaboda.org': 'd2r0s1pmhg5xrd.cloudfront.net',

    // Georgia
    'www.radiotavisupleba.ge': 'd22m21tuy5cszg.cloudfront.net',
    'www.ekhokavkaza.com': 'd2652p7airfs8d.cloudfront.net',

    // Iran
    'www.radiofarda.com': 'd1rszwrnlitcdf.cloudfront.net',

    // Kazakhstan
    'rus.azattyq.org': 'd1sugjw44vshqd.cloudfront.net',
    'www.azattyq.org': 'd3h442fwe0so5h.cloudfront.net',

    // Kyrgyzstan
    'rus.azattyk.org': 'd1tpuu4nxnmigr.cloudfront.net',
    'www.azattyk.org': 'dqo4kc1dcw9iw.cloudfront.net',

    // Russia
    'www.severreal.org': 'd625y3otpz58.cloudfront.net',
    'www.sibreal.org': 'd2aywdt457pcvn.cloudfront.net',
    'www.idelreal.org': 'd3p450x7d8uz2l.cloudfront.net',
    'www.radiomarsho.com': 'd3h19gyd9z3hf5.cloudfront.net',
    'www.svoboda.org': 'd3ro389divh0hy.cloudfront.net',
    'www.azatliq.org': 'd1a90ccd464upe.cloudfront.net',
    'www.kavkazr.com': 'd2bmwbp2lbk4sx.cloudfront.net',

    // Crimea
    'ktat.krymr.com': 'd3432zbwpwz1eg.cloudfront.net',
    'ru.krymr.com': 'd3c11l8t5r2z4n.cloudfront.net',
    'ua.krymr.com': 'd182du3kmtwlt4.cloudfront.net',

    // Current Time (Russia programming unit)
    'www.currenttime.tv': 'd2so81gt3r7oma.cloudfront.net',
    'en.currenttime.tv': 'd21gehdv3gydp3.cloudfront.net',

    // Tajikistan
    'rus.ozodi.org': 'd1y4kdirfc66fb.cloudfront.net',
    'www.ozodi.org': 'd2xporsu1xzbjj.cloudfront.net',

    // Turkmenistan
    'rus.azathabar.com': 'd1si1vkmj688ic.cloudfront.net',
    'www.azathabar.com': 'd2uckb3le254jc.cloudfront.net',

    // Uzbekistan
    'rus.ozodlik.org': 'd2vkmv7y44gye5.cloudfront.net',
    'www.ozodlik.org': 'd2p9n3yor5segm.cloudfront.net',

    // International

    'www.rferl.org': 'dbscbnspz9ye.cloudfront.net',

    // Central Asian Russian-language coverage; no verified static mirror available.
    'www.azattyqasia.org': null,
};

/** Accept bare aliases only when their www hostname is explicitly supported. */
export function normalizeSupportedURL(input: string): URL | null {
    const url = new URL(input);
    if (!Object.hasOwn(domains, url.hostname)) {
        const canonical = `www.${url.hostname}`;
        if (!Object.hasOwn(domains, canonical)) return null;
        url.hostname = canonical;
    }
    return url;
}

// Closed newsrooms retain their original domains for archived articles.
export const archivedServices: Record<string, { name: string; closedOn: string }> = {
    'www.mashaalradio.com': { name: 'Radio Mashaal', closedOn: '2026-03-31' },
    'www.ekhokavkaza.com': { name: 'Ekho Kavkaza', closedOn: '2026-05-01' },
};
