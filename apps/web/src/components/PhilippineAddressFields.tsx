"use client";

import { useEffect, useMemo, useState } from "react";
import { philippines, type PsgcSummary } from "@ianlabicani/geoph-lite";
import type { StorefrontShippingAddress } from "@universal-music-store/validation";

type Props = {
  address: StorefrontShippingAddress;
  onChange: (_address: StorefrontShippingAddress) => void;
  idPrefix?: string;
};

function optionLabel(area: PsgcSummary) {
  return area.type ? `${area.name} (${area.type})` : area.name;
}

function sameAreaName(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function PhilippineAddressFields({ address, onChange, idPrefix = "shipping" }: Props) {
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [localityCode, setLocalityCode] = useState("");
  const [regions, setRegions] = useState<readonly PsgcSummary[]>(() => philippines.regions());
  const [provinces, setProvinces] = useState<PsgcSummary[]>([]);
  const [localities, setLocalities] = useState<PsgcSummary[]>([]);
  const [barangays, setBarangays] = useState<PsgcSummary[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => regions.find((area) => area.psgc_code === regionCode),
    [regions, regionCode],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const all = philippines.regions();
        if (active) setRegions(all);
      } catch {
        if (active) setRegions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Restore saved addresses into the real PSGC selectors. The profile stores
  // canonical names, while the controls need their PSGC codes to remain
  // valid and to load the next level of the cascade.
  useEffect(() => {
    if (regionCode || !address.province || regions.length === 0) return;
    let active = true;
    void Promise.all(
      regions.map(async (region) => {
        if (region.name.includes("National Capital") && sameAreaName(address.province, "Metro Manila")) {
          return region.psgc_code;
        }
        const items = await philippines.provinces(region.psgc_code).catch(() => []);
        return items.some((item) => sameAreaName(item.name, address.province)) ? region.psgc_code : null;
      }),
    ).then((codes) => {
      if (!active) return;
      const match = codes.find((code): code is string => Boolean(code));
      if (match) setRegionCode(match);
    });
    return () => {
      active = false;
    };
  }, [address.province, regionCode, regions]);

  useEffect(() => {
    let active = true;
    setProvinceCode("");
    setLocalityCode("");
    setProvinces([]);
    setLocalities([]);
    setBarangays([]);
    if (!regionCode) return;
    setLoading("province");
    void philippines.provinces(regionCode).then((items) => {
      if (active) {
        setProvinces(items);
        if (items.length === 0 && selectedRegion?.name.includes("National Capital")) {
          setProvinceCode("__ncr__");
          onChange({ ...address, province: "Metro Manila" });
        } else if (address.province) {
          const savedProvince = items.find((item) => sameAreaName(item.name, address.province));
          if (savedProvince) setProvinceCode(savedProvince.psgc_code);
        }
      }
    }).catch(() => {
      if (active) setProvinces([]);
    }).finally(() => {
      if (active) setLoading(null);
    });
    return () => {
      active = false;
    };
  }, [regionCode]);

  useEffect(() => {
    let active = true;
    setLocalityCode("");
    setLocalities([]);
    setBarangays([]);
    const parentCode = provinceCode && provinceCode !== "__ncr__"
      ? provinceCode
      : (selectedRegion?.psgc_code ?? "");
    if (!parentCode) return;
    setLoading("locality");
    void philippines.localities(parentCode).then((items) => {
      if (active) {
        setLocalities(items);
        if (address.city) {
          const savedCity = items.find((item) => sameAreaName(item.name, address.city));
          if (savedCity) setLocalityCode(savedCity.psgc_code);
        }
      }
    }).catch(() => {
      if (active) setLocalities([]);
    }).finally(() => {
      if (active) setLoading(null);
    });
    return () => {
      active = false;
    };
  }, [provinceCode, selectedRegion]);

  useEffect(() => {
    let active = true;
    setBarangays([]);
    if (!localityCode) return;
    setLoading("barangay");
    void philippines.barangays(localityCode).then((items) => {
      if (active) setBarangays(items);
    }).catch(() => {
      if (active) setBarangays([]);
    }).finally(() => {
      if (active) setLoading(null);
    });
    return () => {
      active = false;
    };
  }, [localityCode]);

  const update = (key: keyof StorefrontShippingAddress, value: string) =>
    onChange({ ...address, [key]: value });
  const changeRegion = (code: string) => {
    setRegionCode(code);
    setProvinceCode("");
    setLocalityCode("");
    onChange({ ...address, province: "", city: "", barangay: "" });
  };
  const changeProvince = (code: string) => {
    setProvinceCode(code);
    setLocalityCode("");
    const province = provinces.find((item) => item.psgc_code === code);
    onChange({ ...address, province: province?.name ?? (selectedRegion?.name ?? ""), city: "", barangay: "" });
  };
  const selectClass = "mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
      <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${idPrefix}-line1`}>
        Street address
        <input id={`${idPrefix}-line1`} required className="mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm" value={address.line1} onChange={(e) => update("line1", e.target.value)} name="shipping-address-line1" autoComplete="shipping address-line1" />
      </label>
      <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${idPrefix}-region`}>
        Region
        <select id={`${idPrefix}-region`} required className={selectClass} value={regionCode} onChange={(e) => changeRegion(e.target.value)} autoComplete="shipping address-level1">
          <option value="">Select region</option>
          {regions.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{area.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${idPrefix}-province`}>
        Province
        <select id={`${idPrefix}-province`} required className={selectClass} value={provinceCode} onChange={(e) => changeProvince(e.target.value)} disabled={!regionCode || loading === "province"} autoComplete="shipping address-level1">
          <option value="">{loading === "province" ? "Loading provinces…" : "Select province"}</option>
          {selectedRegion?.name.includes("National Capital") ? <option value="__ncr__">Metro Manila (NCR)</option> : null}
          {provinces.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{area.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${idPrefix}-city`}>
        City or municipality
        <select id={`${idPrefix}-city`} required className={selectClass} value={localityCode} onChange={(e) => { const code = e.target.value; setLocalityCode(code); const locality = localities.find((item) => item.psgc_code === code); update("city", locality?.name ?? ""); }} disabled={!regionCode || loading === "locality"} autoComplete="shipping address-level2">
          <option value="">{loading === "locality" ? "Loading cities…" : "Select city or municipality"}</option>
          {localities.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{optionLabel(area)}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-on-surface-variant" htmlFor={`${idPrefix}-barangay`}>
        Barangay
        <select id={`${idPrefix}-barangay`} required className={selectClass} value={address.barangay ?? ""} onChange={(e) => update("barangay", e.target.value)} disabled={!localityCode || loading === "barangay"} autoComplete="shipping address-level3">
          <option value="">{loading === "barangay" ? "Loading barangays…" : "Select barangay"}</option>
          {barangays.map((area) => <option key={area.psgc_code} value={area.name}>{area.name}</option>)}
        </select>
      </label>
    </>
  );
}
