// import React, { useEffect, useMemo, useState } from "react";
// import {
//   FiPlus,
//   FiSearch,
//   FiEdit2,
//   FiTrash2,
//   FiX,
//   FiMapPin,
//   FiPhone,
//   FiMail,
//   FiUser,
//   FiPackage,
//   FiRefreshCw,
// } from "react-icons/fi";
// import "./vendormanagement.css";

// const API_BASE = "https://ecotrack-mqko.onrender.com";

// const defaultForm = {
//   vendor_name: "",
//   contact_person: "",
//   phone: "",
//   email: "",
//   waste_types: "",
//   area: "",
//   address: "",
//   status: "Active",
// };

// export default function VendorManagement() {
//   const [vendors, setVendors] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const [search, setSearch] = useState("");
//   const [areaFilter, setAreaFilter] = useState("All");
//   const [statusFilter, setStatusFilter] = useState("All");

//   const [showModal, setShowModal] = useState(false);
//   const [editingVendor, setEditingVendor] = useState(null);
//   const [form, setForm] = useState(defaultForm);
//   const [saving, setSaving] = useState(false);

//   const [deleteLoadingId, setDeleteLoadingId] = useState(null);

//   const fetchVendors = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API_BASE}/api/vendors`);
//       const data = await res.json();
//       setVendors(Array.isArray(data) ? data : []);
//     } catch (err) {
//       console.error("Failed to fetch vendors:", err);
//       setVendors([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchVendors();
//   }, []);

//   const uniqueAreas = useMemo(() => {
//     const areas = vendors
//       .map((v) => (v.area || "").trim())
//       .filter(Boolean)
//       .sort((a, b) => a.localeCompare(b));
//     return ["All", ...new Set(areas)];
//   }, [vendors]);

//   const stats = useMemo(() => {
//     const total = vendors.length;
//     const active = vendors.filter(
//       (v) => String(v.status).toLowerCase() === "active"
//     ).length;
//     const inactive = vendors.filter(
//       (v) => String(v.status).toLowerCase() === "inactive"
//     ).length;
//     const areas = new Set(vendors.map((v) => v.area).filter(Boolean)).size;

//     return { total, active, inactive, areas };
//   }, [vendors]);

//   const filteredVendors = useMemo(() => {
//     return vendors.filter((vendor) => {
//       const matchesSearch =
//         !search ||
//         [
//           vendor.vendor_name,
//           vendor.contact_person,
//           vendor.phone,
//           vendor.email,
//           vendor.waste_types,
//           vendor.area,
//           vendor.address,
//         ]
//           .join(" ")
//           .toLowerCase()
//           .includes(search.toLowerCase());

//       const matchesArea =
//         areaFilter === "All" || (vendor.area || "") === areaFilter;

//       const matchesStatus =
//         statusFilter === "All" || (vendor.status || "") === statusFilter;

//       return matchesSearch && matchesArea && matchesStatus;
//     });
//   }, [vendors, search, areaFilter, statusFilter]);

//   const resetForm = () => {
//     setForm(defaultForm);
//     setEditingVendor(null);
//   };

//   const openAddModal = () => {
//     resetForm();
//     setShowModal(true);
//   };

//   const openEditModal = (vendor) => {
//     setEditingVendor(vendor);
//     setForm({
//       vendor_name: vendor.vendor_name || "",
//       contact_person: vendor.contact_person || "",
//       phone: vendor.phone || "",
//       email: vendor.email || "",
//       waste_types: vendor.waste_types || "",
//       area: vendor.area || "",
//       address: vendor.address || "",
//       status: vendor.status || "Active",
//     });
//     setShowModal(true);
//   };

//   const closeModal = () => {
//     if (saving) return;
//     setShowModal(false);
//     resetForm();
//   };

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const validateForm = () => {
//     if (!form.vendor_name.trim()) {
//       alert("Vendor name is required");
//       return false;
//     }
//     if (!form.waste_types.trim()) {
//       alert("Waste types are required");
//       return false;
//     }
//     return true;
//   };

//   const handleSaveVendor = async (e) => {
//     e.preventDefault();

//     if (!validateForm()) return;

//     try {
//       setSaving(true);

//       const method = editingVendor ? "PUT" : "POST";
//       const url = editingVendor
//         ? `${API_BASE}/api/vendors/${editingVendor.id}`
//         : `${API_BASE}/api/vendors`;

//       const payload = {
//         vendor_name: form.vendor_name.trim(),
//         contact_person: form.contact_person.trim(),
//         phone: form.phone.trim(),
//         email: form.email.trim(),
//         waste_types: form.waste_types.trim(),
//         area: form.area.trim(),
//         address: form.address.trim(),
//         status: form.status,
//       };

//       const res = await fetch(url, {
//         method,
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.error || "Failed to save vendor");
//       }

//       await fetchVendors();
//       closeModal();
//       alert(
//         editingVendor
//           ? "Vendor updated successfully"
//           : "Vendor added successfully"
//       );
//     } catch (err) {
//       console.error("Save vendor error:", err);
//       alert(err.message || "Something went wrong");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDeleteVendor = async (vendorId) => {
//     const ok = window.confirm("Are you sure you want to delete this vendor?");
//     if (!ok) return;

//     try {
//       setDeleteLoadingId(vendorId);

//       const res = await fetch(`${API_BASE}/api/vendors/${vendorId}`, {
//         method: "DELETE",
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.error || "Failed to delete vendor");
//       }

//       await fetchVendors();
//       alert("Vendor deleted successfully");
//     } catch (err) {
//       console.error("Delete vendor error:", err);
//       alert(err.message || "Something went wrong");
//     } finally {
//       setDeleteLoadingId(null);
//     }
//   };

//   return (
//     <div className="vendor-page">
//       <div className="vendor-page-header">
//         <div>
//           <h1>Vendor Management</h1>
//           <p>Manage bulky waste, e-waste, scrap, and special pickup vendors</p>
//         </div>

//         <div className="vendor-header-actions">
//           <button
//             type="button"
//             className="vendor-refresh-btn"
//             onClick={fetchVendors}
//           >
//             <FiRefreshCw />
//             Refresh
//           </button>

//           <button
//             type="button"
//             className="vendor-add-btn"
//             onClick={openAddModal}
//           >
//             <FiPlus />
//             Add Vendor
//           </button>
//         </div>
//       </div>

//       <div className="vendor-stats-grid">
//         <div className="vendor-stat-card">
//           <div className="vendor-stat-icon vendor-total">🏢</div>
//           <div className="vendor-stat-content">
//             <h4>Total Vendors</h4>
//             <h2>{stats.total}</h2>
//           </div>
//         </div>

//         <div className="vendor-stat-card">
//           <div className="vendor-stat-icon vendor-active">✅</div>
//           <div className="vendor-stat-content">
//             <h4>Active</h4>
//             <h2>{stats.active}</h2>
//           </div>
//         </div>

//         <div className="vendor-stat-card">
//           <div className="vendor-stat-icon vendor-inactive">⏸️</div>
//           <div className="vendor-stat-content">
//             <h4>Inactive</h4>
//             <h2>{stats.inactive}</h2>
//           </div>
//         </div>

//         <div className="vendor-stat-card">
//           <div className="vendor-stat-icon vendor-zones">📍</div>
//           <div className="vendor-stat-content">
//             <h4>Covered Areas</h4>
//             <h2>{stats.areas}</h2>
//           </div>
//         </div>
//       </div>

//       <div className="vendor-filters-card">
//         <div className="vendor-search-box">
//           <FiSearch className="vendor-search-icon" />
//           <input
//             type="text"
//             placeholder="Search by vendor, contact person, phone, email, waste type, area..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>

//         <select
//           value={areaFilter}
//           onChange={(e) => setAreaFilter(e.target.value)}
//           className="vendor-filter-select"
//         >
//           {uniqueAreas.map((area) => (
//             <option key={area} value={area}>
//               {area === "All" ? "All Areas" : area}
//             </option>
//           ))}
//         </select>

//         <select
//           value={statusFilter}
//           onChange={(e) => setStatusFilter(e.target.value)}
//           className="vendor-filter-select"
//         >
//           <option value="All">All Status</option>
//           <option value="Active">Active</option>
//           <option value="Inactive">Inactive</option>
//         </select>
//       </div>

//       {loading ? (
//         <div className="vendor-empty-state">Loading vendors...</div>
//       ) : filteredVendors.length === 0 ? (
//         <div className="vendor-empty-state">
//           No vendors found. Try changing filters or add a new vendor.
//         </div>
//       ) : (
//         <div className="vendor-grid">
//           {filteredVendors.map((vendor) => (
//             <div className="vendor-card" key={vendor.id}>
//               <div className="vendor-card-top">
//                 <div>
//                   <h3>{vendor.vendor_name}</h3>
//                   <p className="vendor-contact-person">
//                     <FiUser />
//                     {vendor.contact_person || "No contact person"}
//                   </p>
//                 </div>

//                 <span
//                   className={`vendor-status-badge ${
//                     String(vendor.status).toLowerCase() === "active"
//                       ? "active"
//                       : "inactive"
//                   }`}
//                 >
//                   {vendor.status || "Active"}
//                 </span>
//               </div>

//               <div className="vendor-card-body">
//                 <p>
//                   <FiPhone />
//                   {vendor.phone || "No phone"}
//                 </p>
//                 <p>
//                   <FiMail />
//                   {vendor.email || "No email"}
//                 </p>
//                 <p>
//                   <FiMapPin />
//                   {vendor.area || "No area"}
//                 </p>
//                 <p>
//                   <FiPackage />
//                   {vendor.waste_types || "No waste types"}
//                 </p>

//                 {vendor.address ? (
//                   <div className="vendor-address-box">{vendor.address}</div>
//                 ) : null}
//               </div>

//               <div className="vendor-card-actions">
//                 <button
//                   type="button"
//                   className="vendor-edit-btn"
//                   onClick={() => openEditModal(vendor)}
//                 >
//                   <FiEdit2 />
//                   Edit
//                 </button>

//                 <button
//                   type="button"
//                   className="vendor-delete-btn"
//                   onClick={() => handleDeleteVendor(vendor.id)}
//                   disabled={deleteLoadingId === vendor.id}
//                 >
//                   <FiTrash2 />
//                   {deleteLoadingId === vendor.id ? "Deleting..." : "Delete"}
//                 </button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {showModal && (
//         <div className="vendor-modal-overlay">
//           <div className="vendor-modal">
//             <div className="vendor-modal-header">
//               <h2>{editingVendor ? "Edit Vendor" : "Add Vendor"}</h2>
//               <button
//                 type="button"
//                 className="vendor-modal-close"
//                 onClick={closeModal}
//               >
//                 <FiX />
//               </button>
//             </div>

//             <form className="vendor-form" onSubmit={handleSaveVendor}>
//               <div className="vendor-form-grid">
//                 <div className="vendor-form-group">
//                   <label>Vendor Name *</label>
//                   <input
//                     type="text"
//                     name="vendor_name"
//                     value={form.vendor_name}
//                     onChange={handleChange}
//                     placeholder="Enter vendor company name"
//                   />
//                 </div>

//                 <div className="vendor-form-group">
//                   <label>Contact Person</label>
//                   <input
//                     type="text"
//                     name="contact_person"
//                     value={form.contact_person}
//                     onChange={handleChange}
//                     placeholder="Enter contact person"
//                   />
//                 </div>

//                 <div className="vendor-form-group">
//                   <label>Phone</label>
//                   <input
//                     type="text"
//                     name="phone"
//                     value={form.phone}
//                     onChange={handleChange}
//                     placeholder="Enter phone number"
//                   />
//                 </div>

//                 <div className="vendor-form-group">
//                   <label>Email</label>
//                   <input
//                     type="email"
//                     name="email"
//                     value={form.email}
//                     onChange={handleChange}
//                     placeholder="Enter email address"
//                   />
//                 </div>

//                 <div className="vendor-form-group">
//                   <label>Area</label>
//                   <input
//                     type="text"
//                     name="area"
//                     value={form.area}
//                     onChange={handleChange}
//                     placeholder="Enter service area"
//                   />
//                 </div>

//                 <div className="vendor-form-group">
//                   <label>Status</label>
//                   <select
//                     name="status"
//                     value={form.status}
//                     onChange={handleChange}
//                   >
//                     <option value="Active">Active</option>
//                     <option value="Inactive">Inactive</option>
//                   </select>
//                 </div>

//                 <div className="vendor-form-group vendor-form-group-full">
//                   <label>Waste Types *</label>
//                   <input
//                     type="text"
//                     name="waste_types"
//                     value={form.waste_types}
//                     onChange={handleChange}
//                     placeholder="Example: Bulky Items, E-Waste, Scrap"
//                   />
//                 </div>

//                 <div className="vendor-form-group vendor-form-group-full">
//                   <label>Address</label>
//                   <textarea
//                     name="address"
//                     value={form.address}
//                     onChange={handleChange}
//                     rows="4"
//                     placeholder="Enter vendor address"
//                   />
//                 </div>
//               </div>

//               <div className="vendor-modal-actions">
//                 <button
//                   type="button"
//                   className="vendor-cancel-btn"
//                   onClick={closeModal}
//                 >
//                   Cancel
//                 </button>

//                 <button
//                   type="submit"
//                   className="vendor-save-btn"
//                   disabled={saving}
//                 >
//                   {saving
//                     ? editingVendor
//                       ? "Updating..."
//                       : "Saving..."
//                     : editingVendor
//                     ? "Update Vendor"
//                     : "Save Vendor"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


import React, { useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiX,
  FiMapPin,
  FiPhone,
  FiMail,
  FiUser,
  FiPackage,
  FiRefreshCw,
} from "react-icons/fi";
import "./vendormanagement.css";

const API_BASE = "https://ecotrack-mqko.onrender.com";

const defaultForm = {
  vendor_name: "",
  contact_person: "",
  phone: "",
  email: "",
  waste_types: "",
  area: "",
  status: "Active",
};

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/vendors`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const uniqueAreas = useMemo(() => {
    const areas = vendors
      .map((v) => (v.area || "").trim())
      .filter(Boolean);
    return ["All", ...new Set(areas)];
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesSearch =
        !search ||
        [
          vendor.vendor_name,
          vendor.contact_person,
          vendor.phone,
          vendor.email,
          vendor.waste_types,
          vendor.area,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesArea =
        areaFilter === "All" || (vendor.area || "") === areaFilter;

      const matchesStatus =
        statusFilter === "All" || (vendor.status || "") === statusFilter;

      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [vendors, search, areaFilter, statusFilter]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingVendor(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setForm({
      vendor_name: vendor.vendor_name || "",
      contact_person: vendor.contact_person || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      waste_types: vendor.waste_types || "",
      area: vendor.area || "",
      status: vendor.status || "Active",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    resetForm();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Allow only numbers for phone
    if (name === "phone") {
      if (!/^\d*$/.test(value)) return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const phoneRegex = /^[6-9]\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.vendor_name.trim()) {
      alert("Vendor name is required");
      return false;
    }

    if (!form.contact_person.trim()) {
      alert("Contact person is required");
      return false;
    }

    if (!phoneRegex.test(form.phone.trim())) {
      alert("Enter valid 10-digit phone number");
      return false;
    }

    if (!emailRegex.test(form.email.trim())) {
      alert("Enter valid email");
      return false;
    }

    if (!form.area.trim()) {
      alert("Area is required");
      return false;
    }

    if (!form.waste_types.trim()) {
      alert("Waste types are required");
      return false;
    }

    return true;
  };

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);

      const method = editingVendor ? "PUT" : "POST";
      const url = editingVendor
        ? `${API_BASE}/api/vendors/${editingVendor.id}`
        : `${API_BASE}/api/vendors`;

      const payload = {
        vendor_name: form.vendor_name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        waste_types: form.waste_types.trim(),
        area: form.area.trim(),
        status: form.status,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      await fetchVendors();
      closeModal();
      alert(editingVendor ? "Updated ✅" : "Added ✅");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm("Delete vendor?")) return;

    try {
      setDeleteLoadingId(id);
      await fetch(`${API_BASE}/api/vendors/${id}`, { method: "DELETE" });
      fetchVendors();
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="vendor-page">
      <div className="vendor-page-header">
        <h1>Vendor Management</h1>

        <div>
          <button onClick={fetchVendors}>
            <FiRefreshCw /> Refresh
          </button>
          <button onClick={openAddModal}>
            <FiPlus /> Add Vendor
          </button>
        </div>
      </div>

      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="vendor-grid">
        {filteredVendors.map((v) => (
          <div key={v.id} className="vendor-card">
            <h3>{v.vendor_name}</h3>
            <p><FiUser /> {v.contact_person}</p>
            <p><FiPhone /> {v.phone}</p>
            <p><FiMail /> {v.email}</p>
            <p><FiMapPin /> {v.area}</p>
            <p><FiPackage /> {v.waste_types}</p>

            <button onClick={() => openEditModal(v)}>
              <FiEdit2 /> Edit
            </button>
            <button onClick={() => handleDeleteVendor(v.id)}>
              <FiTrash2 /> Delete
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal">
          <form onSubmit={handleSaveVendor}>
            <input name="vendor_name" placeholder="Vendor Name" onChange={handleChange} value={form.vendor_name} />
            <input name="contact_person" placeholder="Contact Person" onChange={handleChange} value={form.contact_person} />
            <input name="phone" placeholder="Phone" maxLength="10" onChange={handleChange} value={form.phone} />
            <input name="email" placeholder="Email" onChange={handleChange} value={form.email} />
            <input name="area" placeholder="Area" onChange={handleChange} value={form.area} />
            <input name="waste_types" placeholder="Waste Types" onChange={handleChange} value={form.waste_types} />

            <button type="submit">{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={closeModal}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}