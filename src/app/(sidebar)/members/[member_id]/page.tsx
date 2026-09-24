"use client"

import { DatePickerDemo } from "@/components/custom/date-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import React, { use, useEffect, useState } from "react"
import { format, parse } from "date-fns"
import { AddMember, GetMemberById, MemberInput, MemberResponse, UpdateMemberById } from "@/action/member.action"
// import { Gender } from "@/app/generated/prisma"
import { toast } from "sonner"
import { Phone } from "lucide-react"
import { useParams } from "next/navigation"
import { useLoading } from "@/hooks/use-loading"
import AttendanceSummary from "./AttendanceSummary"
import { MemberAccountPanel } from "./MemberAccountPanel"

type Gender = "male" | "female" | "other"
interface FormState {
  name: string
  phone: string
  email: string
  gender: string
  DOB: string
  DOJ: string
  address: string
}



const page = ({params}: {params:any}) => {
  const [formState, setFormState] = useState<MemberResponse >({
    id: "",
    name: "",
    email: "",
    memberCode: "",
    phone: BigInt(0),
    address: "",
    DOB: "",
    gender: "other",
    DOJ: "",
    createdAt: new Date(),
    updatedAt: new Date()
  }) 
  const unwrappedParams = React.use(params)
  const { member_id } = unwrappedParams as {member_id: string}
  const {showLoading, hideLoading, isLoading} = useLoading()
  useEffect(()=>{
    showLoading()
    async function fetchData() {
      const data = await GetMemberById(member_id)
      if(!data) {
        return
      }
      setFormState(data)
      hideLoading()
      console.log(data)
    }
    fetchData()
  }, [])


  const handleInputChange = (
    e: any,
    field: keyof FormState
  ) => {
    setFormState((prev) => ({ ...prev, [field]: e }))
  }

  const handleGenderChange = (value: Gender) => {
    setFormState((prev) => ({ ...prev, gender: value }))
  }



  const handleOnSubmit = async () => {
    if(formState.name === "" || formState.phone === null || formState.DOB === "" || formState.DOJ === "") {
      toast.error("Please fill all the required fields")
      return
    }
    if(formState.phone.toString().length !== 10) {
      toast.error("Phone number must be 10 digits")
      return
    }
    // console.log("Form submitted with state:", formState)
    // db operation
    const response = await UpdateMemberById(member_id as string, formState as any)
    if(response.id){
      toast.success("Member updated successfully")
    }
  }
  
  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div>
      <h1 className="text-3xl font-semibold">Update member details</h1>
      <p className="text-muted-foreground text-sm">Fields marked with <span className="text-destructive">*</span> are required</p>
      </div>
      <Separator className="" />
      <div className="space-y-2">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Name"
          type="text"
          required
          value={formState.name}
          onChange={(e) => handleInputChange(e.target.value, "name")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Phone <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Phone"
          type="tel"
          required
          value={(formState.phone.toString())}
          onChange={(e) => handleInputChange(e.target.value, "phone")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Email
        </Label>
        <Input
          placeholder="Email"
          type="email"
          value={formState.email || ""}
          onChange={(e) => handleInputChange(e.target.value, "email")}
        />
      </div>
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm leading-none font-medium">
          Gender <span className="text-destructive">*</span>
        </legend>
        <RadioGroup
          className="flex flex-wrap gap-2"
          value={formState.gender}
          onValueChange={handleGenderChange}
        >
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="female"
                className="after:absolute after:inset-0"
              />
              <Label>Female</Label>
            </div>
          </div>
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="male"
                className="after:absolute after:inset-0"
              />
              <Label>Male</Label>
            </div>
          </div>
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="other"
                className="after:absolute after:inset-0"
              />
              <Label>Other</Label>
            </div>
          </div>
        </RadioGroup>
      </fieldset>
      <div className="space-y-2">
        <Label>
          Date of Birth <span className="text-destructive">*</span> Selected: {formState.DOB}
        </Label>
        <DatePickerDemo
          defaultDate={formState.DOB}
          onDateChange={(e)=>handleInputChange(e, "DOB")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Date of Join <span className="text-destructive">*</span> Selected: {formState.DOJ}
        </Label>
        <DatePickerDemo
          defaultDate={formState.DOJ}
          onDateChange={(e)=>handleInputChange(e, "DOJ")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Address
        </Label>
        <Input
          placeholder="Address"
          type="text"
          value={formState.address || ""}
          onChange={(e) => handleInputChange(e.target.value, "address")}
        />
      </div>
      <Button className="w-full md:w-fit px-8" onClick={handleOnSubmit}>
        Update
      </Button>
      <Separator/>
      {formState.id && <MemberAccountPanel memberId={member_id} name={formState.name} />}
      <AttendanceSummary member_id={member_id}/>
    </div>
  )
}

export default page