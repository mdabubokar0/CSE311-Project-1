import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../Bars/Sidebar";
import { Profile } from "../../Profile/Profile";
import Button from "../../Button/Button";

export const EditService = () => {
  const { serviceId } = useParams();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const navigate = useNavigate();
  const [service, setService] = useState({});
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    treatment_id: "",
    service_name: "",
    service_cost: "",
  });

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    axios
      .get(`http://localhost:8081/service/${serviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setService(res.data), console.log(res.data);
      })
      .catch((err) => {
        setError("Failed to fetch service data");
        console.error(err);
      });
  }, [serviceId, token, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const isFormComplete = Object.values(formData).some(
      (field) => field !== ""
    );
    if (!isFormComplete) {
      setError("Please fill in at least one required field.");
      return;
    }

    if (window.confirm("Are you sure you want to update info?")) {
      console.log(formData);

      axios
        .patch(`http://localhost:8081/update/service/${serviceId}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((res) => {
          console.log("Service updated successfully", res.data);
          alert("Service updated successfully");
        })
        .catch((error) => {
          console.error("Error updating service:", error);
        });
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="px-3 w-full">
        <div className="top-0 flex items-center justify-between sticky bg-[#EFF0F6] z-10 py-3">
          <h1 className="text-[28px] font-semibold">Edit Service</h1>
          <Profile />
        </div>
        {role === "admin" ? (
          <div className="bg-[#FAFAFA] rounded-[20px] p-5 w-full">
            {error && (
              <div className="bg-red-200 text-red-600 p-2 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1 text-[#009BA9] text-[16px] w-full">
                  <label htmlFor="treatment_id">Treatment ID</label>
                  <input
                    onChange={handleChange}
                    className="p-3 w-full h-[48px] rounded-[8px] bg-[#FAFAFA] border-l-[1px] border-l-[#009BA9] border-b-[1px] border-b-[#009BA9] focus:outline-none"
                    type="number"
                    placeholder={service.treatment_id}
                    name="treatment_id"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1 text-[#009BA9] text-[16px] w-full">
                  <label htmlFor="service_name">Service Name</label>
                  <input
                    onChange={handleChange}
                    className="p-3 w-full h-[48px] rounded-[8px] bg-[#FAFAFA] border-l-[1px] border-l-[#009BA9] border-b-[1px] border-b-[#009BA9] focus:outline-none"
                    type="text"
                    placeholder={service.service_name}
                    name="service_name"
                  />
                </div>
                <div className="flex flex-col gap-1 text-[#009BA9] text-[16px] w-full">
                  <label htmlFor="service_cost">Service Cost</label>
                  <input
                    onChange={handleChange}
                    className="p-3 w-full h-[48px] rounded-[8px] bg-[#FAFAFA] border-l-[1px] border-l-[#009BA9] border-b-[1px] border-b-[#009BA9] focus:outline-none"
                    type="number"
                    placeholder={service.service_cost}
                    name="service_cost"
                  />
                </div>
              </div>
              <Button name="UPDATE" />
            </form>
          </div>
        ) : (
          <div className="text-center">You don't have access to this page</div>
        )}
      </div>
    </div>
  );
};
