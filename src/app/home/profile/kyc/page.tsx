"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function KycPage() {
    const router = useRouter();
    const { t } = useI18n();
    const [status, setStatus] = useState<string>("LOADING");
    const [notes, setNotes] = useState<string>("");
    const [documentType, setDocumentType] = useState("ID_CARD");
    const [documentNumber, setDocumentNumber] = useState("");
    const [frontImage, setFrontImage] = useState<string>("");
    const [backImage, setBackImage] = useState<string>("");
    const [bankName, setBankName] = useState("");
    const [bankAccountNumber, setBankAccountNumber] = useState("");
    const [bankAccountHolder, setBankAccountHolder] = useState("");
    const [bankBranch, setBankBranch] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingFront, setUploadingFront] = useState(false);
    const [uploadingBack, setUploadingBack] = useState(false);
    const [kycId, setKycId] = useState<string>("");

    useEffect(() => {
        loadKycStatus();
    }, []);

    const loadKycStatus = async () => {
        try {
            const kyc = await api.getKycStatus();
            if (kyc.status) {
                setStatus(kyc.status);
                if (kyc.id) setKycId(kyc.id);
                if (kyc.notes) setNotes(kyc.notes);
                if (kyc.bankName) setBankName(kyc.bankName);
                if (kyc.bankAccountNumber) setBankAccountNumber(kyc.bankAccountNumber);
                if (kyc.bankAccountHolder) setBankAccountHolder(kyc.bankAccountHolder);
                if (kyc.bankBranch) setBankBranch(kyc.bankBranch);
            } else {
                setStatus("UNVERIFIED");
            }
        } catch (e) {
            console.error(e);
            setStatus("UNVERIFIED");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert(t("kycImageTooLarge"));
            return;
        }

        side === 'front' ? setUploadingFront(true) : setUploadingBack(true);
        try {
            const url = await api.uploadAvatar(file); // Reusing uploadAvatar for image upload
            side === 'front' ? setFrontImage(url) : setBackImage(url);
        } catch (error: any) {
            alert(error.message || t("kycUploadFailed"));
        } finally {
            side === 'front' ? setUploadingFront(false) : setUploadingBack(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!documentNumber) return alert(t("kycPleaseEnterDocNumber"));
        if (!frontImage || !backImage) return alert(t("kycPleaseUploadBothImages"));

        setIsSubmitting(true);
        try {
            await api.submitKyc({
                documentType,
                documentNumber,
                frontImage,
                backImage,
                bankName: bankName.trim() || undefined,
                bankAccountNumber: bankAccountNumber.trim() || undefined,
                bankAccountHolder: bankAccountHolder.trim() || undefined,
                bankBranch: bankBranch.trim() || undefined,
            });
            alert(t("kycSubmittedSuccess"));
            loadKycStatus();
        } catch (e: any) {
            alert(e.message || t("kycSubmissionFailed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteKyc = async () => {
        if (!kycId) return;
        if (!confirm("Bạn có chắc chắn muốn xóa yêu cầu KYC này không?")) return;
        try {
            await api.deleteMyKyc(kycId);
            alert("Đã xóa yêu cầu KYC thành công.");
            
            // Reset form
            setDocumentNumber("");
            setFrontImage("");
            setBackImage("");
            setBankName("");
            setBankAccountNumber("");
            setBankAccountHolder("");
            setBankBranch("");
            
            loadKycStatus();
        } catch (e: any) {
            alert(e.message || "Xóa KYC thất bại");
        }
    };

    if (status === "LOADING") {
        return <div className="p-8 text-center text-slate-500">{t("loading")}</div>;
    }

    return (
        <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-display">
            <header className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-50 border-b border-gray-100">
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-50 transition-colors"
                >
                    <span className="material-symbols-outlined text-slate-800">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("kycTitle")}</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-32">
                {status === "PENDING" && (
                    <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl border border-orange-100 flex flex-col items-center text-center">
                        <span className="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
                        <h2 className="font-bold text-lg mb-1">{t("kycStatusPending")}</h2>
                        <p className="text-sm mb-4">{t("kycStatusPendingDesc")}</p>
                        <button type="button" onClick={handleDeleteKyc} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-semibold py-2 px-6 rounded-xl text-sm transition-colors">
                            Xóa yêu cầu
                        </button>
                    </div>
                )}

                {status === "APPROVED" && (
                    <div className="bg-green-50 text-green-600 p-4 rounded-2xl border border-green-100 flex flex-col items-center text-center">
                        <span className="material-symbols-outlined text-4xl mb-2">verified</span>
                        <h2 className="font-bold text-lg mb-1">{t("kycStatusApproved")}</h2>
                        <p className="text-sm">{t("kycStatusApprovedDesc")}</p>
                    </div>
                )}

                {(status === "UNVERIFIED" || status === "REJECTED") && (
                    <div>
                        {status === "REJECTED" && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined">error</span>
                                    <h2 className="font-bold text-lg">{t("kycStatusRejected")}</h2>
                                </div>
                                <p className="text-sm mb-2">{t("kycStatusRejectedDesc")}</p>
                                {notes && <p className="text-xs bg-red-100 p-2 rounded-lg italic">{t("kycAdminNote")} {notes}</p>}
                                <p className="text-sm mt-2 mb-4">{t("kycPleaseResubmit")}</p>
                                <button type="button" onClick={handleDeleteKyc} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors w-full">
                                    Xóa yêu cầu cũ để tạo lại
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycDocumentType")}</label>
                                <select
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="ID_CARD">{t("kycIdCard")}</option>
                                    <option value="PASSPORT">{t("kycPassport")}</option>
                                    <option value="DRIVERS_LICENSE">{t("kycDriversLicense")}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycDocumentNumber")}</label>
                                <input
                                    type="text"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    placeholder={t("kycDocumentNumberPlaceholder")}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycFrontImage")}</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                                    {frontImage ? (
                                        <div className="relative rounded-xl overflow-hidden h-32 w-full">
                                            <img src={frontImage} alt="Front ID" className="object-cover w-full h-full" />
                                            <button type="button" onClick={() => setFrontImage("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full">
                                            {uploadingFront ? (
                                                <span className="material-symbols-outlined text-3xl animate-spin text-slate-400">progress_activity</span>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">add_photo_alternate</span>
                                                    <span className="text-sm font-medium text-slate-600">{t("kycUploadFrontSide")}</span>
                                                </>
                                            )}
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'front')} disabled={uploadingFront} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycBackImage")}</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                                    {backImage ? (
                                        <div className="relative rounded-xl overflow-hidden h-32 w-full">
                                            <img src={backImage} alt="Back ID" className="object-cover w-full h-full" />
                                            <button type="button" onClick={() => setBackImage("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full">
                                            {uploadingBack ? (
                                                <span className="material-symbols-outlined text-3xl animate-spin text-slate-400">progress_activity</span>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">add_photo_alternate</span>
                                                    <span className="text-sm font-medium text-slate-600">{t("kycUploadBackSide")}</span>
                                                </>
                                            )}
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'back')} disabled={uploadingBack} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-sm font-semibold text-slate-700 mb-3">{t("kycBankingInfo")}</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycBankName")}</label>
                                        <input
                                            type="text"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            placeholder="VD: Vietcombank"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycBankAccountNumber")}</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={bankAccountNumber}
                                            onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ""))}
                                            placeholder="VD: 1234567890"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycBankAccountHolder")}</label>
                                        <input
                                            type="text"
                                            value={bankAccountHolder}
                                            onChange={(e) => setBankAccountHolder(e.target.value)}
                                            placeholder="VD: NGUYEN VAN A"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t("kycBankBranch")}</label>
                                        <input
                                            type="text"
                                            value={bankBranch}
                                            onChange={(e) => setBankBranch(e.target.value)}
                                            placeholder="VD: Chi nhánh Hà Nội"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !documentNumber || !frontImage || !backImage}
                                className="w-full mt-6 py-4 rounded-xl font-bold text-sm tracking-wide bg-primary text-white hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t("kycSubmitting") : t("kycSubmitRequest")}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
