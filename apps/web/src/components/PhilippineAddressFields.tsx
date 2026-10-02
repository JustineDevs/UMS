"use client";

import { useEffect, useMemo, useReducer } from "react";
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

type AddressState = {
  regionCode: string;
  provinceCode: string;
  localityCode: string;
  regions: readonly PsgcSummary[];
  provinces: PsgcSummary[];
  localities: PsgcSummary[];
  barangays: PsgcSummary[];
  loading: string | null;
};

type AddressAction =
  | { type: "regionCode"; value: string }
  | { type: "provinceCode"; value: string }
  | { type: "localityCode"; value: string }
  | { type: "regions"; value: readonly PsgcSummary[] }
  | { type: "provinces"; value: PsgcSummary[] }
  | { type: "localities"; value: PsgcSummary[] }
  | { type: "barangays"; value: PsgcSummary[] }
  | { type: "loading"; value: string | null }
  | { type: "resetProvinceCascade" }
  | { type: "resetLocalityCascade" };

const initialAddressState: AddressState = {
  regionCode: "",
  provinceCode: "",
  localityCode: "",
  regions: philippines.regions(),
  provinces: [],
  localities: [],
  barangays: [],
  loading: null,
};

function addressReducer(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case "regionCode": return { ...state, regionCode: action.value };
    case "provinceCode": return { ...state, provinceCode: action.value };
    case "localityCode": return { ...state, localityCode: action.value };
    case "regions": return { ...state, regions: action.value };
    case "provinces": return { ...state, provinces: action.value };
    case "localities": return { ...state, localities: action.value };
    case "barangays": return { ...state, barangays: action.value };
    case "loading": return { ...state, loading: action.value };
    case "resetProvinceCascade": return { ...state, provinceCode: "", localityCode: "", provinces: [], localities: [], barangays: [] };
    case "resetLocalityCascade": return { ...state, localityCode: "", localities: [], barangays: [] };
    default: return state;
  }
}

export function PhilippineAddressFields({ address, onChange, idPrefix = "shipping" }: Props) {
  const [{ regionCode, provinceCode, localityCode, regions, provinces, localities, barangays, loading }, dispatch] = useReducer(
    addressReducer,
    initialAddressState,
  );
  const selectedRegion = useMemo(
    () => regions.find((area) => area.psgc_code === regionCode),
    [regions, regionCode],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const all = philippines.regions();
        if (active) dispatch({ type: "regions", value: all });
      } catch {
        if (active) dispatch({ type: "regions", value: [] });
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
      if (match) dispatch({ type: "regionCode", value: match });
    });
    return () => {
      active = false;
    };
  }, [address.province, regionCode, regions]);

  useEffect(() => {
    let active = true;
    dispatch({ type: "resetProvinceCascade" });
    if (!regionCode) return;
    dispatch({ type: "loading", value: "province" });
    void philippines.provinces(regionCode).then((items) => {
      if (active) {
        dispatch({ type: "provinces", value: items });
        const savedProvince = address.province;
        if (items.length === 0 && selectedRegion?.name.includes("National Capital") && sameAreaName(savedProvince, "Metro Manila")) {
          dispatch({ type: "provinceCode", value: "__ncr__" });
        } else if (savedProvince) {
          const savedProvinceItem = items.find((item) => sameAreaName(item.name, savedProvince));
          if (savedProvinceItem) dispatch({ type: "provinceCode", value: savedProvinceItem.psgc_code });
        }
      }
    }).catch(() => {
      if (active) dispatch({ type: "provinces", value: [] });
    }).finally(() => {
      if (active) dispatch({ type: "loading", value: null });
    });
    return () => {
      active = false;
    };
  }, [regionCode, selectedRegion?.name]);

  useEffect(() => {
    let active = true;
    dispatch({ type: "resetLocalityCascade" });
    const parentCode = provinceCode && provinceCode !== "__ncr__"
      ? provinceCode
      : (selectedRegion?.psgc_code ?? "");
    if (!parentCode) return;
    dispatch({ type: "loading", value: "locality" });
    void philippines.localities(parentCode).then((items) => {
      if (active) {
        dispatch({ type: "localities", value: items });
        const savedCityName = address.city;
        if (savedCityName) {
          const savedCity = items.find((item) => sameAreaName(item.name, savedCityName));
          if (savedCity) dispatch({ type: "localityCode", value: savedCity.psgc_code });
        }
      }
    }).catch(() => {
      if (active) dispatch({ type: "localities", value: [] });
    }).finally(() => {
      if (active) dispatch({ type: "loading", value: null });
    });
    return () => {
      active = false;
    };
  }, [provinceCode, selectedRegion?.psgc_code]);

  useEffect(() => {
    let active = true;
    dispatch({ type: "barangays", value: [] });
    if (!localityCode) return;
    dispatch({ type: "loading", value: "barangay" });
    void philippines.barangays(localityCode).then((items) => {
      if (active) dispatch({ type: "barangays", value: items });
    }).catch(() => {
      if (active) dispatch({ type: "barangays", value: [] });
    }).finally(() => {
      if (active) dispatch({ type: "loading", value: null });
    });
    return () => {
      active = false;
    };
  }, [localityCode]);

  const update = (key: keyof StorefrontShippingAddress, value: string) =>
    onChange({ ...address, [key]: value });
  const changeRegion = (code: string) => {
    dispatch({ type: "regionCode", value: code });
    dispatch({ type: "resetProvinceCascade" });
    onChange({ ...address, province: "", city: "", barangay: "" });
  };
  const changeProvince = (code: string) => {
    dispatch({ type: "provinceCode", value: code });
    dispatch({ type: "resetLocalityCascade" });
    const province = provinces.find((item) => item.psgc_code === code);
    onChange({ ...address, province: province?.name ?? (selectedRegion?.name ?? ""), city: "", barangay: "" });
  };
  const selectClass = "mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-primary sm:col-span-2" htmlFor={`${idPrefix}-line1`}>
        Street address
        <input id={`${idPrefix}-line1`} required className="mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm" value={address.line1} onChange={(e) => update("line1", e.target.value)} name="shipping-address-line1" autoComplete="shipping address-line1" />
      </label>
      <label className="block text-sm font-medium text-primary" htmlFor={`${idPrefix}-region`}>
        Region
        <select id={`${idPrefix}-region`} required className={selectClass} value={regionCode} onChange={(e) => changeRegion(e.target.value)} autoComplete="shipping address-level1">
          <option value="">Select region</option>
          {regions.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{area.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-primary" htmlFor={`${idPrefix}-province`}>
        Province
        <select id={`${idPrefix}-province`} required className={selectClass} value={provinceCode} onChange={(e) => changeProvince(e.target.value)} disabled={!regionCode || loading === "province"} autoComplete="shipping address-level1">
          <option value="">{loading === "province" ? "Loading provinces…" : "Select province"}</option>
          {selectedRegion?.name.includes("National Capital") && loading !== "province" ? <option value="__ncr__">Metro Manila (NCR)</option> : null}
          {provinces.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{area.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-primary" htmlFor={`${idPrefix}-city`}>
        City or municipality
        <select id={`${idPrefix}-city`} required className={selectClass} value={localityCode} onChange={(e) => { const code = e.target.value; dispatch({ type: "localityCode", value: code }); const locality = localities.find((item) => item.psgc_code === code); update("city", locality?.name ?? ""); }} disabled={!regionCode || loading === "locality"} autoComplete="shipping address-level2">
          <option value="">{loading === "locality" ? "Loading cities…" : "Select city or municipality"}</option>
          {localities.map((area) => <option key={area.psgc_code} value={area.psgc_code}>{optionLabel(area)}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-primary" htmlFor={`${idPrefix}-barangay`}>
        Barangay
        <select id={`${idPrefix}-barangay`} required className={selectClass} value={address.barangay ?? ""} onChange={(e) => update("barangay", e.target.value)} disabled={!localityCode || loading === "barangay"} autoComplete="shipping address-level3">
          <option value="">{loading === "barangay" ? "Loading barangays…" : "Select barangay"}</option>
          {barangays.map((area) => <option key={area.psgc_code} value={area.name}>{area.name}</option>)}
        </select>
      </label>
    </div>
  );
}
